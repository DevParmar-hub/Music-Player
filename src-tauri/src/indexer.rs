use rusqlite::Connection;
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;

use crate::content_identity::generate_content_key;
use crate::db::queries::{
    find_or_create_album,
    find_or_create_artist,
    find_track_file_by_path,
    find_track_files_by_content_key,
    insert_track,
    register_track_file,
    reconcile_scan_paths,
    set_track_file_hash,
    update_track,
    update_track_file_identity,
    TrackFileRow,
};
use crate::metadata::{read_metadata, TrackMetadata};

// ============================================================
// Index Outcome
// ============================================================

/// What indexing a single file did to the library.
#[derive(Debug)]
pub enum IndexOutcome {
    /// A new logical track was created for this file.
    Inserted { track_id: i64 },
    /// The file is an identical copy of an existing track and was
    /// registered as an additional physical location.
    DuplicateRegistered { track_id: i64 },
    /// The file is already registered and has not changed.
    Unchanged,
    /// The file is registered but changed on disk (e.g. tags were
    /// edited); its identity and the track's metadata were refreshed.
    Updated { track_id: i64 },
}

impl IndexOutcome {
    pub fn describe(&self, path: &Path) -> String {
        match self {
            Self::Inserted { track_id } => format!(
                "Track inserted successfully with ID: {}",
                track_id
            ),
            Self::DuplicateRegistered { track_id } => format!(
                "Duplicate file registered for track ID {}: {}",
                track_id,
                path.display()
            ),
            Self::Unchanged => format!(
                "Track already indexed: {}",
                path.display()
            ),
            Self::Updated { track_id } => format!(
                "Track {} updated from changed file: {}",
                track_id,
                path.display()
            ),
        }
    }
}

// ============================================================
// Scan Summary
// ============================================================

#[derive(Debug)]
pub struct ScanSummary {
    pub files_found: usize,
    pub indexed: usize,
    pub already_indexed: usize,
    pub updated: usize,
    pub failed: usize,
    pub errors: Vec<String>,
    pub unavailable: usize,
}

// ============================================================
// File Helpers
// ============================================================

fn get_file_mtime(path: &Path) -> Result<i64, String> {
    std::fs::metadata(path)
        .map_err(|error| {
            format!(
                "Failed to read file metadata for '{}': {}",
                path.display(),
                error
            )
        })?
        .modified()
        .map_err(|error| {
            format!(
                "Failed to read modification time for '{}': {}",
                path.display(),
                error
            )
        })?
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|error| error.to_string())
        .map(|duration| duration.as_millis() as i64)
}

/// Calculate SHA-256 over the entire file.
///
/// Unlike generate_content_key(), this reads every byte and is
/// used to confirm that two candidate files are truly identical.
fn generate_full_file_hash(path: &Path) -> Result<String, String> {
    let file = File::open(path).map_err(|error| {
        format!(
            "Failed to open file '{}' for full hashing: {}",
            path.display(),
            error
        )
    })?;

    let mut reader = BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];

    loop {
        let bytes_read = reader.read(&mut buffer).map_err(|error| {
            format!(
                "Failed to read file '{}' for full hashing: {}",
                path.display(),
                error
            )
        })?;

        if bytes_read == 0 {
            break;
        }

        hasher.update(&buffer[..bytes_read]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

/// Resolve the artist and album IDs for a file's tags, creating
/// rows as needed. Blank names are treated as missing.
fn resolve_artist_and_album(
    connection: &Connection,
    metadata: &TrackMetadata,
) -> Result<(Option<i64>, Option<i64>), String> {
    let artist_id = match metadata.artist.as_deref() {
        Some(artist_name) if !artist_name.trim().is_empty() => {
            Some(find_or_create_artist(connection, artist_name)?)
        }
        _ => None,
    };

    let album_id = match metadata.album.as_deref() {
        Some(album_title) if !album_title.trim().is_empty() => {
            Some(find_or_create_album(
                connection,
                album_title,
                artist_id,
            )?)
        }
        _ => None,
    };

    Ok((artist_id, album_id))
}

// ============================================================
// Find a Matching Physical File
// ============================================================

/// Return the existing logical track if a registered file has
/// identical full-file SHA-256 content.
///
/// The partial content key narrows the candidates in SQL. The new
/// file is only fully hashed once a candidate exists, and that hash
/// is cached in `new_file_hash` so the caller can store it.
fn find_duplicate_track(
    connection: &Connection,
    path: &Path,
    content_key: &str,
    new_file_hash: &mut Option<String>,
) -> Result<Option<i64>, String> {
    let candidates = find_track_files_by_content_key(connection, content_key)?;

    for candidate in candidates {
        let Some(candidate_hash) = candidate_full_hash(connection, &candidate)?
        else {
            continue;
        };

        if new_file_hash.is_none() {
            *new_file_hash = Some(generate_full_file_hash(path)?);
        }

        if new_file_hash.as_deref() == Some(candidate_hash.as_str()) {
            return Ok(Some(candidate.track_id));
        }
    }

    Ok(None)
}

/// Full-file hash of a registered candidate.
///
/// A stored hash is trusted only while the file's mtime matches the
/// one recorded at indexing time. Missing hashes (rows migrated from
/// older schemas) are computed once and stored. A missing file is
/// not usable as a candidate; reconciliation will handle it later.
fn candidate_full_hash(
    connection: &Connection,
    candidate: &TrackFileRow,
) -> Result<Option<String>, String> {
    let candidate_path = Path::new(&candidate.file_path);

    if !candidate_path.is_file() {
        return Ok(None);
    }

    let mtime_matches =
        get_file_mtime(candidate_path)? == candidate.file_mtime;

    match (&candidate.full_hash, mtime_matches) {
        (Some(hash), true) => Ok(Some(hash.clone())),
        (None, true) => {
            let hash = generate_full_file_hash(candidate_path)?;
            set_track_file_hash(connection, candidate.id, &hash)?;
            Ok(Some(hash))
        }
        // Changed since it was indexed; compare its current content
        // but leave the stored identity for the next scan to refresh.
        (_, false) => Ok(Some(generate_full_file_hash(candidate_path)?)),
    }
}

// ============================================================
// Index a Single Track
// ============================================================

/// Index one file inside its own transaction, so a failure part way
/// through never leaves a track without its file row (or vice versa).
pub fn index_track(
    connection: &Connection,
    path: &Path,
) -> Result<IndexOutcome, String> {
    let transaction = connection
        .unchecked_transaction()
        .map_err(|error| error.to_string())?;

    let outcome = index_track_inner(&transaction, path)?;

    transaction.commit().map_err(|error| error.to_string())?;

    Ok(outcome)
}

fn index_track_inner(
    connection: &Connection,
    path: &Path,
) -> Result<IndexOutcome, String> {
    let file_path = path.to_string_lossy().into_owned();
    let file_mtime = get_file_mtime(path)?;

    // Fast path: a registered file whose mtime has not changed needs
    // no hashing or tag reading at all.
    if let Some(existing) = find_track_file_by_path(connection, &file_path)? {
        if existing.file_mtime == file_mtime {
            return Ok(IndexOutcome::Unchanged);
        }

        return refresh_changed_file(connection, path, &existing, file_mtime);
    }

    let content_key = generate_content_key(path)?;
    let mut full_hash = None;

    if let Some(track_id) =
        find_duplicate_track(connection, path, &content_key, &mut full_hash)?
    {
        let date_added = chrono::Utc::now().timestamp_millis();

        register_track_file(
            connection,
            track_id,
            &file_path,
            file_mtime,
            date_added,
            &content_key,
            full_hash.as_deref(),
        )?;

        return Ok(IndexOutcome::DuplicateRegistered { track_id });
    }

    // No identical file was found among the candidates.
    // Create a separate logical track.
    println!("New track found: {}", path.display());

    let metadata = read_metadata(path)?;
    let (artist_id, album_id) = resolve_artist_and_album(connection, &metadata)?;
    let date_added = chrono::Utc::now().timestamp_millis();

    let track_id = insert_track(
        connection,
        &content_key,
        &file_path,
        metadata.title.as_deref().unwrap_or("Unknown Title"),
        artist_id,
        album_id,
        metadata.genre.as_deref(),
        metadata.track_number.map(|value| value as i64),
        metadata.disc_number.map(|value| value as i64),
        metadata.duration_ms,
        date_added,
        file_mtime,
    )?;

    // The full hash is only known if a candidate forced it; otherwise
    // it is computed lazily the first time this file is a candidate.
    register_track_file(
        connection,
        track_id,
        &file_path,
        file_mtime,
        date_added,
        &content_key,
        full_hash.as_deref(),
    )?;

    Ok(IndexOutcome::Inserted { track_id })
}

/// A registered file changed on disk, most often because its tags
/// were edited. Keep it attached to its logical track, refresh the
/// stored content identity, and take the track's metadata from the
/// new tags.
fn refresh_changed_file(
    connection: &Connection,
    path: &Path,
    existing: &TrackFileRow,
    file_mtime: i64,
) -> Result<IndexOutcome, String> {
    let content_key = generate_content_key(path)?;
    let full_hash = generate_full_file_hash(path)?;

    // Only the timestamp changed (e.g. a copy or touch).
    if existing.full_hash.as_deref() == Some(full_hash.as_str()) {
        update_track_file_identity(
            connection,
            existing,
            file_mtime,
            &content_key,
            &full_hash,
        )?;

        return Ok(IndexOutcome::Unchanged);
    }

    let metadata = read_metadata(path)?;
    let (artist_id, album_id) = resolve_artist_and_album(connection, &metadata)?;

    update_track(
        connection,
        existing.track_id,
        metadata.title.as_deref().unwrap_or("Unknown Title"),
        artist_id,
        album_id,
        metadata.genre.as_deref(),
        metadata.track_number.map(|value| value as i64),
        metadata.disc_number.map(|value| value as i64),
    )?;

    update_track_file_identity(
        connection,
        existing,
        file_mtime,
        &content_key,
        &full_hash,
    )?;

    Ok(IndexOutcome::Updated {
        track_id: existing.track_id,
    })
}

// ============================================================
// Scan and Index an Entire Directory
// ============================================================

pub fn scan_and_index_directory(
    connection: &Connection,
    root: &Path,
) -> Result<ScanSummary, String> {
    let files = crate::scanner::scan_directory(root)?;

    let mut summary = ScanSummary {
        files_found: files.len(),
        indexed: 0,
        already_indexed: 0,
        updated: 0,
        failed: 0,
        errors: Vec::new(),
        unavailable: 0,
    };

    let found_paths: Vec<String> = files.iter().map(|path| path.to_string_lossy().into_owned()).collect();

    for path in files {
        match index_track(connection, &path) {
            Ok(IndexOutcome::Inserted { .. }) => summary.indexed += 1,

            Ok(IndexOutcome::DuplicateRegistered { .. })
            | Ok(IndexOutcome::Unchanged) => summary.already_indexed += 1,

            Ok(IndexOutcome::Updated { .. }) => summary.updated += 1,

            Err(error) => {
                summary.failed += 1;
                summary.errors.push(format!(
                    "{}: {}",
                    path.display(),
                    error
                ));
            }
        }
    }

    summary.unavailable = reconcile_scan_paths(
        connection,
        &root.to_string_lossy(),
        &found_paths,
    )?;

    Ok(summary)
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::time::{Duration, SystemTime};

    fn open_test_database() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch("PRAGMA foreign_keys = ON;")
            .unwrap();
        crate::db::migrations::run_migrations(&connection).unwrap();
        connection
    }

    fn test_directory(name: &str) -> PathBuf {
        let directory = std::env::temp_dir()
            .join(format!("music-player-indexer-{}-{}", name, std::process::id()));
        let _ = std::fs::remove_dir_all(&directory);
        std::fs::create_dir_all(&directory).unwrap();
        directory
    }

    /// Write a minimal 16-bit mono PCM WAV file.
    fn write_wav(path: &Path, seed: i16) {
        let samples: Vec<i16> = (0..8000).map(|i| (i as i16).wrapping_mul(seed)).collect();
        let data_len = (samples.len() * 2) as u32;

        let mut bytes = Vec::new();
        bytes.extend_from_slice(b"RIFF");
        bytes.extend_from_slice(&(36 + data_len).to_le_bytes());
        bytes.extend_from_slice(b"WAVEfmt ");
        bytes.extend_from_slice(&16u32.to_le_bytes());
        bytes.extend_from_slice(&1u16.to_le_bytes()); // PCM
        bytes.extend_from_slice(&1u16.to_le_bytes()); // mono
        bytes.extend_from_slice(&8000u32.to_le_bytes()); // sample rate
        bytes.extend_from_slice(&16000u32.to_le_bytes()); // byte rate
        bytes.extend_from_slice(&2u16.to_le_bytes()); // block align
        bytes.extend_from_slice(&16u16.to_le_bytes()); // bits per sample
        bytes.extend_from_slice(b"data");
        bytes.extend_from_slice(&data_len.to_le_bytes());
        for sample in samples {
            bytes.extend_from_slice(&sample.to_le_bytes());
        }

        std::fs::write(path, bytes).unwrap();
    }

    fn bump_mtime(path: &Path) {
        File::options()
            .write(true)
            .open(path)
            .unwrap()
            .set_modified(SystemTime::now() + Duration::from_secs(60))
            .unwrap();
    }

    fn count(connection: &Connection, table: &str) -> i64 {
        connection
            .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| row.get(0))
            .unwrap()
    }

    #[test]
    fn reindexing_an_unchanged_file_is_a_no_op() {
        let connection = open_test_database();
        let path = test_directory("unchanged").join("song.wav");
        write_wav(&path, 3);

        assert!(matches!(
            index_track(&connection, &path).unwrap(),
            IndexOutcome::Inserted { .. }
        ));
        assert!(matches!(
            index_track(&connection, &path).unwrap(),
            IndexOutcome::Unchanged
        ));
        assert_eq!(count(&connection, "tracks"), 1);
        assert_eq!(count(&connection, "track_files"), 1);
    }

    #[test]
    fn identical_copy_is_registered_on_the_same_track() {
        let connection = open_test_database();
        let directory = test_directory("duplicate");
        let original = directory.join("a.wav");
        let copy = directory.join("b.wav");
        write_wav(&original, 5);
        std::fs::copy(&original, &copy).unwrap();

        let IndexOutcome::Inserted { track_id } =
            index_track(&connection, &original).unwrap()
        else {
            panic!("expected insert");
        };

        assert!(matches!(
            index_track(&connection, &copy).unwrap(),
            IndexOutcome::DuplicateRegistered { track_id: id } if id == track_id
        ));
        assert_eq!(count(&connection, "tracks"), 1);
        assert_eq!(count(&connection, "track_files"), 2);

        // The original's hash was computed lazily and stored.
        let stored = find_track_file_by_path(&connection, &original.to_string_lossy())
            .unwrap()
            .unwrap();
        assert!(stored.full_hash.is_some());
    }

    #[test]
    fn different_content_is_a_new_track() {
        let connection = open_test_database();
        let directory = test_directory("distinct");
        let first = directory.join("a.wav");
        let second = directory.join("b.wav");
        write_wav(&first, 5);
        write_wav(&second, 7);

        index_track(&connection, &first).unwrap();
        assert!(matches!(
            index_track(&connection, &second).unwrap(),
            IndexOutcome::Inserted { .. }
        ));
        assert_eq!(count(&connection, "tracks"), 2);
    }

    #[test]
    fn changed_file_updates_its_track_instead_of_failing() {
        let connection = open_test_database();
        let path = test_directory("changed").join("song.wav");
        write_wav(&path, 3);

        let IndexOutcome::Inserted { track_id } =
            index_track(&connection, &path).unwrap()
        else {
            panic!("expected insert");
        };

        write_wav(&path, 11);
        bump_mtime(&path);

        assert!(matches!(
            index_track(&connection, &path).unwrap(),
            IndexOutcome::Updated { track_id: id } if id == track_id
        ));
        assert!(matches!(
            index_track(&connection, &path).unwrap(),
            IndexOutcome::Unchanged
        ));
        assert_eq!(count(&connection, "tracks"), 1);
        assert_eq!(count(&connection, "track_files"), 1);
    }

    #[test]
    fn touched_but_identical_file_is_unchanged() {
        let connection = open_test_database();
        let directory = test_directory("touched");
        let path = directory.join("song.wav");
        let copy = directory.join("copy.wav");
        write_wav(&path, 3);
        std::fs::copy(&path, &copy).unwrap();

        index_track(&connection, &path).unwrap();
        // Force the full hash to be stored for `path`.
        index_track(&connection, &copy).unwrap();

        bump_mtime(&path);

        assert!(matches!(
            index_track(&connection, &path).unwrap(),
            IndexOutcome::Unchanged
        ));
    }

    #[test]
    fn migrations_are_idempotent() {
        let connection = open_test_database();
        crate::db::migrations::run_migrations(&connection).unwrap();

        let version: i64 = connection
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 2);
    }
}
