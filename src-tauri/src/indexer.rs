
use rusqlite::Connection;
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::{Path, PathBuf};

use crate::content_identity::generate_content_key;
use crate::db::queries::{
    find_or_create_album,
    find_or_create_artist,
    get_track_files,
    get_tracks,
    insert_track,
    register_track_file,
};
use crate::metadata::read_metadata;

// ============================================================
// Scan Summary
// ============================================================

#[derive(Debug)]
pub struct ScanSummary {
    pub files_found: usize,
    pub indexed: usize,
    pub already_indexed: usize,
    pub failed: usize,
    pub errors: Vec<String>,
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

// ============================================================
// Find a Matching Physical File
// ============================================================

/// Return the existing logical track if a candidate has identical
/// full-file SHA-256 content.
///
/// The partial content key narrows the candidates. Full-file SHA-256
/// determines whether the content can actually be merged.
fn find_duplicate_track(
    connection: &Connection,
    content_key: &str,
    new_file_hash: &str,
) -> Result<Option<i64>, String> {
    let tracks = get_tracks(connection)?;

    for track in tracks
        .into_iter()
        .filter(|track| track.content_key == content_key)
    {
        let mut candidate_paths = vec![PathBuf::from(&track.file_path)];

        // Include every registered physical location for this track.
        let track_files = get_track_files(connection, track.id)?;

        candidate_paths.extend(
            track_files
                .into_iter()
                .map(|file| PathBuf::from(file.file_path)),
        );

        // A track's legacy file_path and track_files may refer to
        // the same path, so avoid hashing that path twice.
        candidate_paths.sort();
        candidate_paths.dedup();

        for candidate_path in candidate_paths {
            // A missing file is not usable as a content comparison
            // candidate. Reconciliation will handle missing files later.
            if !candidate_path.is_file() {
                continue;
            }

            let candidate_hash = generate_full_file_hash(&candidate_path)?;

            if candidate_hash == new_file_hash {
                return Ok(Some(track.id));
            }
        }
    }

    Ok(None)
}

// ============================================================
// Index a Single Track
// ============================================================

pub fn index_track(
    connection: &Connection,
    path: &Path,
) -> Result<String, String> {
    let content_key = generate_content_key(path)?;
    let full_file_hash = generate_full_file_hash(path)?;

    // Search all tracks with the same partial key, then verify
    // candidates using a complete SHA-256 hash.
    if let Some(track_id) = find_duplicate_track(
        connection,
        &content_key,
        &full_file_hash,
    )? {
        let file_path = path.to_string_lossy().into_owned();
        let file_mtime = get_file_mtime(path)?;
        let date_added = chrono::Utc::now().timestamp_millis();

        let inserted = register_track_file(
            connection,
            track_id,
            &file_path,
            file_mtime,
            date_added,
        )?;

        if inserted {
            return Ok(format!(
                "Duplicate file registered for track ID {}: {}",
                track_id,
                path.display()
            ));
        }

        return Ok(format!(
            "Track already indexed: {}",
            path.display()
        ));
    }

    // No identical file was found among the candidates.
    // Create a separate logical track.
    println!("New track found: {}", path.display());

    let metadata = read_metadata(path)?;

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

    let file_path = path.to_string_lossy().into_owned();
    let file_mtime = get_file_mtime(path)?;
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

    // Register the primary file in the new table as well.
    // This keeps new tracks consistent with migrated tracks.
    register_track_file(
        connection,
        track_id,
        &file_path,
        file_mtime,
        date_added,
    )?;

    Ok(format!(
        "Track inserted successfully with ID: {}",
        track_id
    ))
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
        failed: 0,
        errors: Vec::new(),
    };

    for path in files {
        match index_track(connection, &path) {
            Ok(message)
                if message.starts_with("Track inserted successfully") =>
            {
                summary.indexed += 1;
            }

            Ok(message)
                if message.starts_with("Duplicate file registered")
                    || message.starts_with("Track already indexed") =>
            {
                summary.already_indexed += 1;
            }

            Ok(message) => {
                summary.failed += 1;
                summary.errors.push(format!(
                    "{}: Unexpected result: {}",
                    path.display(),
                    message
                ));
            }

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

    Ok(summary)
}
