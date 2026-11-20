use rusqlite::{params, Connection, ErrorCode, OptionalExtension};
use serde::Serialize;

use super::library::{map_track, Track, TRACK_COLUMN_COUNT, TRACK_SELECT};

const MAX_NAME_LENGTH: usize = 100;
const MOSAIC_SIZE: i64 = 4;

// ============================================================
// Playlist DTOs
// ============================================================

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Playlist {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub sync_to_folder: bool,
    pub folder_path: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub track_count: i64,
    pub duration_ms: i64,
    /// Up to four distinct covers for the playlist's mosaic.
    pub artwork_hashes: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistEntry {
    /// Identifies this occurrence; a track may appear more than once.
    pub entry_id: i64,
    pub position: i64,
    pub added_at: i64,
    pub track: Track,
}

// ============================================================
// Reading
// ============================================================

const PLAYLIST_SELECT: &str = "
    SELECT
        p.id,
        p.name,
        p.description,
        p.sync_to_folder,
        p.folder_path,
        p.created_at,
        p.updated_at,
        COUNT(pt.id),
        COALESCE(SUM(t.duration_ms), 0)
    FROM playlists p
    LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
    LEFT JOIN tracks t ON t.id = pt.track_id
";

fn read_playlists(
    connection: &Connection,
    filter: &str,
    parameters: impl rusqlite::Params,
) -> Result<Vec<Playlist>, String> {
    let mut statement = connection
        .prepare(&format!(
            "{PLAYLIST_SELECT} {filter} GROUP BY p.id ORDER BY p.name COLLATE NOCASE"
        ))
        .map_err(|error| error.to_string())?;

    let mut playlists = statement
        .query_map(parameters, |row| {
            Ok(Playlist {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                sync_to_folder: row.get(3)?,
                folder_path: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
                track_count: row.get(7)?,
                duration_ms: row.get(8)?,
                artwork_hashes: Vec::new(),
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<Playlist>, _>>()
        .map_err(|error| error.to_string())?;

    for playlist in &mut playlists {
        playlist.artwork_hashes = mosaic_artwork(connection, playlist.id)?;
    }

    Ok(playlists)
}

fn mosaic_artwork(connection: &Connection, playlist_id: i64) -> Result<Vec<String>, String> {
    let mut statement = connection
        .prepare(
            "
            SELECT t.artwork_hash
            FROM playlist_tracks pt
            JOIN tracks t ON t.id = pt.track_id
            WHERE pt.playlist_id = ?1
              AND t.artwork_hash <> ''
            GROUP BY t.artwork_hash
            ORDER BY MIN(pt.position)
            LIMIT ?2
            ",
        )
        .map_err(|error| error.to_string())?;

    let hashes = statement
        .query_map(params![playlist_id, MOSAIC_SIZE], |row| row.get(0))
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<String>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(hashes)
}

pub fn get_playlists(connection: &Connection) -> Result<Vec<Playlist>, String> {
    read_playlists(connection, "", [])
}

pub fn get_playlist(connection: &Connection, playlist_id: i64) -> Result<Playlist, String> {
    read_playlists(connection, "WHERE p.id = ?1", params![playlist_id])?
        .pop()
        .ok_or_else(|| not_found(playlist_id))
}

pub fn get_playlist_entries(
    connection: &Connection,
    playlist_id: i64,
) -> Result<Vec<PlaylistEntry>, String> {
    let query = TRACK_SELECT.replace(
        "FROM tracks t",
        ", pt.id, pt.position, pt.added_at
        FROM playlist_tracks pt
        JOIN tracks t ON t.id = pt.track_id",
    );

    let mut statement = connection
        .prepare(&format!(
            "{query} WHERE pt.playlist_id = ?1 ORDER BY pt.position, pt.id"
        ))
        .map_err(|error| error.to_string())?;

    let entries = statement
        .query_map(params![playlist_id], |row| {
            Ok(PlaylistEntry {
                track: map_track(row)?,
                entry_id: row.get(TRACK_COLUMN_COUNT)?,
                position: row.get(TRACK_COLUMN_COUNT + 1)?,
                added_at: row.get(TRACK_COLUMN_COUNT + 2)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<PlaylistEntry>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(entries)
}

// ============================================================
// Creating, Renaming, Deleting
// ============================================================

pub fn create_playlist(
    connection: &Connection,
    name: &str,
    description: Option<&str>,
) -> Result<Playlist, String> {
    let name = validate_name(name)?;
    let now = chrono::Utc::now().timestamp_millis();

    connection
        .execute(
            "
            INSERT INTO playlists (name, description, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?3)
            ",
            params![name, clean_description(description), now],
        )
        .map_err(|error| describe_write_error(error, name))?;

    get_playlist(connection, connection.last_insert_rowid())
}

pub fn update_playlist(
    connection: &Connection,
    playlist_id: i64,
    name: &str,
    description: Option<&str>,
) -> Result<Playlist, String> {
    let name = validate_name(name)?;

    let changed = connection
        .execute(
            "
            UPDATE playlists
            SET name = ?1,
                description = ?2,
                updated_at = ?3
            WHERE id = ?4
            ",
            params![
                name,
                clean_description(description),
                chrono::Utc::now().timestamp_millis(),
                playlist_id
            ],
        )
        .map_err(|error| describe_write_error(error, name))?;

    if changed == 0 {
        return Err(not_found(playlist_id));
    }

    get_playlist(connection, playlist_id)
}

pub fn delete_playlist(connection: &Connection, playlist_id: i64) -> Result<(), String> {
    let changed = connection
        .execute("DELETE FROM playlists WHERE id = ?1", params![playlist_id])
        .map_err(|error| error.to_string())?;

    if changed == 0 {
        return Err(not_found(playlist_id));
    }

    Ok(())
}

// ============================================================
// Editing Contents
// ============================================================

/// Add tracks at `insert_at` (0-based), or at the end when `None`.
pub fn add_tracks(
    connection: &Connection,
    playlist_id: i64,
    track_ids: &[i64],
    insert_at: Option<usize>,
) -> Result<(), String> {
    let transaction = connection
        .unchecked_transaction()
        .map_err(|error| error.to_string())?;

    let mut order = ordered_entry_ids(&transaction, playlist_id)?;
    let now = chrono::Utc::now().timestamp_millis();

    let mut new_ids = Vec::with_capacity(track_ids.len());

    for track_id in track_ids {
        transaction
            .execute(
                "
                INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at)
                VALUES (?1, ?2, ?3, ?4)
                ",
                params![playlist_id, track_id, (order.len() + new_ids.len()) as i64, now],
            )
            .map_err(|error| error.to_string())?;

        new_ids.push(transaction.last_insert_rowid());
    }

    let index = insert_at.unwrap_or(order.len()).min(order.len());
    order.splice(index..index, new_ids);

    write_positions(&transaction, playlist_id, &order)?;
    touch(&transaction, playlist_id)?;

    transaction.commit().map_err(|error| error.to_string())
}

pub fn remove_entries(
    connection: &Connection,
    playlist_id: i64,
    entry_ids: &[i64],
) -> Result<(), String> {
    let transaction = connection
        .unchecked_transaction()
        .map_err(|error| error.to_string())?;

    for entry_id in entry_ids {
        transaction
            .execute(
                "DELETE FROM playlist_tracks WHERE id = ?1 AND playlist_id = ?2",
                params![entry_id, playlist_id],
            )
            .map_err(|error| error.to_string())?;
    }

    let order = ordered_entry_ids(&transaction, playlist_id)?;
    write_positions(&transaction, playlist_id, &order)?;
    touch(&transaction, playlist_id)?;

    transaction.commit().map_err(|error| error.to_string())
}

/// Move one entry to `to_index` (0-based) within its playlist.
pub fn move_entry(
    connection: &Connection,
    playlist_id: i64,
    entry_id: i64,
    to_index: usize,
) -> Result<(), String> {
    let transaction = connection
        .unchecked_transaction()
        .map_err(|error| error.to_string())?;

    let mut order = ordered_entry_ids(&transaction, playlist_id)?;

    let from_index = order
        .iter()
        .position(|id| *id == entry_id)
        .ok_or_else(|| format!("Entry {} is not in playlist {}", entry_id, playlist_id))?;

    let entry = order.remove(from_index);
    order.insert(to_index.min(order.len()), entry);

    write_positions(&transaction, playlist_id, &order)?;
    touch(&transaction, playlist_id)?;

    transaction.commit().map_err(|error| error.to_string())
}

// ============================================================
// Helpers
// ============================================================

fn ordered_entry_ids(connection: &Connection, playlist_id: i64) -> Result<Vec<i64>, String> {
    let exists = connection
        .query_row(
            "SELECT 1 FROM playlists WHERE id = ?1",
            params![playlist_id],
            |_| Ok(()),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    if exists.is_none() {
        return Err(not_found(playlist_id));
    }

    let mut statement = connection
        .prepare(
            "
            SELECT id
            FROM playlist_tracks
            WHERE playlist_id = ?1
            ORDER BY position, id
            ",
        )
        .map_err(|error| error.to_string())?;

    let ids = statement
        .query_map(params![playlist_id], |row| row.get(0))
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<i64>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(ids)
}

/// Renumber entries 0..n in the given order.
fn write_positions(connection: &Connection, playlist_id: i64, order: &[i64]) -> Result<(), String> {
    let mut statement = connection
        .prepare(
            "
            UPDATE playlist_tracks
            SET position = ?1
            WHERE id = ?2 AND playlist_id = ?3 AND position != ?1
            ",
        )
        .map_err(|error| error.to_string())?;

    for (position, entry_id) in order.iter().enumerate() {
        statement
            .execute(params![position as i64, entry_id, playlist_id])
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn touch(connection: &Connection, playlist_id: i64) -> Result<(), String> {
    connection
        .execute(
            "UPDATE playlists SET updated_at = ?1 WHERE id = ?2",
            params![chrono::Utc::now().timestamp_millis(), playlist_id],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn validate_name(name: &str) -> Result<&str, String> {
    let name = name.trim();

    if name.is_empty() {
        return Err("Playlist name cannot be empty".to_owned());
    }

    if name.chars().count() > MAX_NAME_LENGTH {
        return Err(format!(
            "Playlist name must be at most {} characters",
            MAX_NAME_LENGTH
        ));
    }

    Ok(name)
}

fn clean_description(description: Option<&str>) -> Option<&str> {
    description
        .map(str::trim)
        .filter(|description| !description.is_empty())
}

fn describe_write_error(error: rusqlite::Error, name: &str) -> String {
    match error.sqlite_error_code() {
        Some(ErrorCode::ConstraintViolation) => {
            format!("A playlist named \"{}\" already exists", name)
        }
        _ => error.to_string(),
    }
}

fn not_found(playlist_id: i64) -> String {
    format!("Playlist with ID {} was not found", playlist_id)
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn open_test_database() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        connection.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        crate::db::migrations::run_migrations(&connection).unwrap();

        for id in 1..=4 {
            connection
                .execute(
                    "
                    INSERT INTO tracks (id, content_key, file_path, title, duration_ms, date_added, file_mtime)
                    VALUES (?1, 'key', ?2, ?3, 1000, 0, 0)
                    ",
                    params![id, format!("C:\\music\\{id}.mp3"), format!("Track {id}")],
                )
                .unwrap();
        }

        connection
    }

    fn track_ids(connection: &Connection, playlist_id: i64) -> Vec<i64> {
        get_playlist_entries(connection, playlist_id)
            .unwrap()
            .into_iter()
            .map(|entry| entry.track.id)
            .collect()
    }

    #[test]
    fn names_are_unique_ignoring_case() {
        let connection = open_test_database();
        create_playlist(&connection, "Road Trip", None).unwrap();

        let error = create_playlist(&connection, "  road trip ", None).unwrap_err();
        assert!(error.contains("already exists"), "{error}");
    }

    #[test]
    fn insert_move_and_remove_keep_order_dense() {
        let connection = open_test_database();
        let playlist = create_playlist(&connection, "Mix", None).unwrap();

        add_tracks(&connection, playlist.id, &[1, 2, 3], None).unwrap();
        add_tracks(&connection, playlist.id, &[4], Some(1)).unwrap();
        assert_eq!(track_ids(&connection, playlist.id), vec![1, 4, 2, 3]);

        let entries = get_playlist_entries(&connection, playlist.id).unwrap();
        move_entry(&connection, playlist.id, entries[0].entry_id, 3).unwrap();
        assert_eq!(track_ids(&connection, playlist.id), vec![4, 2, 3, 1]);

        let entries = get_playlist_entries(&connection, playlist.id).unwrap();
        remove_entries(&connection, playlist.id, &[entries[1].entry_id]).unwrap();

        let positions: Vec<i64> = get_playlist_entries(&connection, playlist.id)
            .unwrap()
            .iter()
            .map(|entry| entry.position)
            .collect();
        assert_eq!(positions, vec![0, 1, 2]);
        assert_eq!(track_ids(&connection, playlist.id), vec![4, 3, 1]);
    }

    #[test]
    fn deleting_a_track_removes_it_from_playlists() {
        let connection = open_test_database();
        let playlist = create_playlist(&connection, "Mix", None).unwrap();
        add_tracks(&connection, playlist.id, &[1, 2, 2], None).unwrap();

        connection.execute("DELETE FROM tracks WHERE id = 2", []).unwrap();

        let playlist = get_playlist(&connection, playlist.id).unwrap();
        assert_eq!(playlist.track_count, 1);
    }
}
