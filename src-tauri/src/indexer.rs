
use std::path::Path;

use rusqlite::Connection;

use crate::content_identity::generate_content_key;
use crate::db::queries::{
    find_or_create_album,
    find_or_create_artist,
    find_track_by_content_key,
    insert_track,
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
// Index a Single Track
// ============================================================

pub fn index_track(
    connection: &Connection,
    path: &Path,
) -> Result<String, String> {
    let content_key = generate_content_key(path)?;

    let existing_track =
        find_track_by_content_key(connection, &content_key)?;

    match existing_track {
        Some(track) => {
            return Ok(format!(
                "Track already indexed: {}",
                track.file_path
            ));
        }
        None => {
            println!("New track found: {}", path.display());
        }
    }

    let metadata = read_metadata(path)?;

    let artist_id = match metadata.artist.as_deref() {
        Some(artist_name) if !artist_name.trim().is_empty() => {
            Some(find_or_create_artist(
                connection,
                artist_name,
            )?)
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

    let file_mtime = std::fs::metadata(path)
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
        .map_err(|error| error.to_string())?
        .as_millis() as i64;

    let date_added = chrono::Utc::now().timestamp_millis();

    let track_id = insert_track(
        connection,
        &content_key,
        &file_path,
        metadata
            .title
            .as_deref()
            .unwrap_or("Unknown Title"),
        artist_id,
        album_id,
        metadata.genre.as_deref(),
        metadata.track_number.map(|value| value as i64),
        metadata.disc_number.map(|value| value as i64),
        metadata.duration_ms,
        date_added,
        file_mtime,
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
                if message.starts_with("Track already indexed") =>
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
