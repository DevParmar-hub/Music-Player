use std::path::Path;

use crate::content_identity::generate_content_key;
use crate::db::queries::{
    find_or_create_album,
    find_or_create_artist,
    find_track_by_content_key,
    insert_track,
};
use crate::metadata::read_metadata;

pub fn index_track(
    connection: &rusqlite::Connection,
    path: &Path,
) -> Result<String, String> {
    // ============================================================
    // 1. Generate content key
    // ============================================================

    let content_key = generate_content_key(path)?;

    // ============================================================
    // 2. Check whether the track is already indexed
    // ============================================================

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
            println!(
                "New track found: {}",
                path.display()
            );
        }
    }

    // ============================================================
    // 3. Read metadata
    // ============================================================

    let metadata = read_metadata(path)?;

    // ============================================================
    // 4. Resolve artist
    // ============================================================

    let artist_id = match metadata.artist.as_deref() {
        Some(artist_name) if !artist_name.trim().is_empty() => {
            Some(find_or_create_artist(
                connection,
                artist_name,
            )?)
        }

        _ => None,
    };

    // ============================================================
    // 5. Resolve album
    // ============================================================

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

    // ============================================================
    // 6. Get file information
    // ============================================================

    let file_path = path
        .to_string_lossy()
        .into_owned();

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

    // ============================================================
    // 7. Generate date added
    // ============================================================

    let date_added =
        chrono::Utc::now().timestamp_millis();

    // ============================================================
    // 8. Insert track
    // ============================================================

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
        metadata
            .track_number
            .map(|value| value as i64),
        metadata
            .disc_number
            .map(|value| value as i64),
        metadata.duration_ms,
        date_added,
        file_mtime,
    )?;

    Ok(format!(
        "Track inserted successfully with ID: {}",
        track_id
    ))
}