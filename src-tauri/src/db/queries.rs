
use rusqlite::{params, Connection, OptionalExtension};

// ============================================================
// Track Row
// ============================================================

#[derive(Debug)]
pub struct TrackRow {
    pub id: i64,
    pub content_key: String,
    pub file_path: String,
    pub title: String,
    pub artist_id: Option<i64>,
    pub album_id: Option<i64>,
    pub genre: Option<String>,
    pub track_number: Option<i64>,
    pub disc_number: Option<i64>,
    pub duration_ms: i64,
    pub date_added: i64,
    pub last_played: Option<i64>,
    pub play_count: i64,
    pub file_mtime: i64,
    pub available: i64,
}

// ============================================================
// Track File Row
// ============================================================

/// Represents one physical file belonging to a logical track.
#[derive(Debug)]
pub struct TrackFileRow {
    pub id: i64,
    pub track_id: i64,
    pub file_path: String,
    pub file_mtime: i64,
    pub available: i64,
    pub date_added: i64,
    pub content_key: Option<String>,
    pub full_hash: Option<String>,
}

// ============================================================
// Artist Queries
// ============================================================

pub fn insert_artist(
    connection: &Connection,
    name: &str,
) -> Result<i64, String> {
    connection
        .execute(
            "INSERT INTO artists (name) VALUES (?1)",
            params![name],
        )
        .map_err(|error| error.to_string())?;

    Ok(connection.last_insert_rowid())
}

pub fn get_artists(
    connection: &Connection,
) -> Result<Vec<(i64, String)>, String> {
    let mut statement = connection
        .prepare(
            "
            SELECT id, name
            FROM artists
            ORDER BY name;
            ",
        )
        .map_err(|error| error.to_string())?;

    let artists = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
            ))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<(i64, String)>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(artists)
}

pub fn update_artist(connection: &Connection, artist_id: i64, name: &str) -> Result<(), String> {
    let changed = connection.execute(
        "UPDATE artists SET name = ?1 WHERE id = ?2",
        params![name.trim(), artist_id],
    ).map_err(|error| error.to_string())?;
    if changed == 0 { return Err(format!("Artist with ID {} was not found", artist_id)); }
    Ok(())
}

pub fn delete_artist(connection: &Connection, artist_id: i64) -> Result<(), String> {
    let changed = connection.execute("DELETE FROM artists WHERE id = ?1", params![artist_id])
        .map_err(|error| error.to_string())?;
    if changed == 0 { return Err(format!("Artist with ID {} was not found", artist_id)); }
    Ok(())
}

pub fn find_or_create_artist(
    connection: &Connection,
    name: &str,
) -> Result<i64, String> {
    let existing_id = connection
        .query_row(
            "
            SELECT id
            FROM artists
            WHERE name = ?1
            ",
            params![name],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    if let Some(id) = existing_id {
        return Ok(id);
    }

    connection
        .execute(
            "INSERT INTO artists (name) VALUES (?1)",
            params![name],
        )
        .map_err(|error| error.to_string())?;

    Ok(connection.last_insert_rowid())
}

// ============================================================
// Album Queries
// ============================================================

pub fn insert_album(
    connection: &Connection,
    title: &str,
    artist_id: Option<i64>,
) -> Result<i64, String> {
    connection
        .execute(
            "
            INSERT INTO albums (title, artist_id)
            VALUES (?1, ?2)
            ",
            params![title, artist_id],
        )
        .map_err(|error| error.to_string())?;

    Ok(connection.last_insert_rowid())
}

pub fn get_albums(
    connection: &Connection,
) -> Result<Vec<(i64, String, Option<i64>)>, String> {
    let mut statement = connection
        .prepare(
            "
            SELECT id, title, artist_id
            FROM albums
            ORDER BY title;
            ",
        )
        .map_err(|error| error.to_string())?;

    let albums = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<i64>>(2)?,
            ))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<(i64, String, Option<i64>)>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(albums)
}

pub fn find_or_create_album(
    connection: &Connection,
    title: &str,
    artist_id: Option<i64>,
) -> Result<i64, String> {
    let existing_id = connection
        .query_row(
            "
            SELECT id
            FROM albums
            WHERE title = ?1
              AND (
                    artist_id = ?2
                    OR (artist_id IS NULL AND ?2 IS NULL)
              )
            ",
            params![title, artist_id],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    if let Some(id) = existing_id {
        return Ok(id);
    }

    connection
        .execute(
            "
            INSERT INTO albums (title, artist_id)
            VALUES (?1, ?2)
            ",
            params![title, artist_id],
        )
        .map_err(|error| error.to_string())?;

    Ok(connection.last_insert_rowid())
}

pub fn update_album(
    connection: &Connection,
    album_id: i64,
    title: &str,
    artist_id: Option<i64>,
) -> Result<(), String> {
    let rows_affected = connection
        .execute(
            "
            UPDATE albums
            SET title = ?1,
                artist_id = ?2
            WHERE id = ?3
            ",
            params![title, artist_id, album_id],
        )
        .map_err(|error| error.to_string())?;

    if rows_affected == 0 {
        return Err(format!(
            "Album with ID {} was not found",
            album_id
        ));
    }

    Ok(())
}

pub fn delete_album(
    connection: &Connection,
    album_id: i64,
) -> Result<(), String> {
    let rows_affected = connection
        .execute(
            "DELETE FROM albums WHERE id = ?1",
            params![album_id],
        )
        .map_err(|error| error.to_string())?;

    if rows_affected == 0 {
        return Err(format!(
            "Album with ID {} was not found",
            album_id
        ));
    }

    Ok(())
}

// ============================================================
// Track Queries
// ============================================================

pub fn insert_track(
    connection: &Connection,
    content_key: &str,
    file_path: &str,
    title: &str,
    artist_id: Option<i64>,
    album_id: Option<i64>,
    genre: Option<&str>,
    track_number: Option<i64>,
    disc_number: Option<i64>,
    duration_ms: i64,
    date_added: i64,
    file_mtime: i64,
) -> Result<i64, String> {
    connection
        .execute(
            "
            INSERT INTO tracks (
                content_key,
                file_path,
                title,
                artist_id,
                album_id,
                genre,
                track_number,
                disc_number,
                duration_ms,
                date_added,
                file_mtime
            )
            VALUES (
                ?1, ?2, ?3, ?4, ?5,
                ?6, ?7, ?8, ?9, ?10, ?11
            )
            ",
            params![
                content_key,
                file_path,
                title,
                artist_id,
                album_id,
                genre,
                track_number,
                disc_number,
                duration_ms,
                date_added,
                file_mtime
            ],
        )
        .map_err(|error| error.to_string())?;

    Ok(connection.last_insert_rowid())
}

pub fn find_track_by_content_key(
    connection: &Connection,
    content_key: &str,
) -> Result<Option<TrackRow>, String> {
    let mut statement = connection
        .prepare(
            "
            SELECT
                id,
                content_key,
                file_path,
                title,
                artist_id,
                album_id,
                genre,
                track_number,
                disc_number,
                duration_ms,
                date_added,
                last_played,
                play_count,
                file_mtime,
                available
            FROM tracks
            WHERE content_key = ?1
            LIMIT 1;
            ",
        )
        .map_err(|error| error.to_string())?;

    let mut rows = statement
        .query(params![content_key])
        .map_err(|error| error.to_string())?;

    if let Some(row) = rows
        .next()
        .map_err(|error| error.to_string())?
    {
        let track = TrackRow {
            id: row.get(0).map_err(|error| error.to_string())?,
            content_key: row.get(1).map_err(|error| error.to_string())?,
            file_path: row.get(2).map_err(|error| error.to_string())?,
            title: row.get(3).map_err(|error| error.to_string())?,
            artist_id: row.get(4).map_err(|error| error.to_string())?,
            album_id: row.get(5).map_err(|error| error.to_string())?,
            genre: row.get(6).map_err(|error| error.to_string())?,
            track_number: row.get(7).map_err(|error| error.to_string())?,
            disc_number: row.get(8).map_err(|error| error.to_string())?,
            duration_ms: row.get(9).map_err(|error| error.to_string())?,
            date_added: row.get(10).map_err(|error| error.to_string())?,
            last_played: row.get(11).map_err(|error| error.to_string())?,
            play_count: row.get(12).map_err(|error| error.to_string())?,
            file_mtime: row.get(13).map_err(|error| error.to_string())?,
            available: row.get(14).map_err(|error| error.to_string())?,
        };

        Ok(Some(track))
    } else {
        Ok(None)
    }
}

pub fn get_tracks(
    connection: &Connection,
) -> Result<Vec<TrackRow>, String> {
    let mut statement = connection
        .prepare(
            "
            SELECT
                id,
                content_key,
                file_path,
                title,
                artist_id,
                album_id,
                genre,
                track_number,
                disc_number,
                duration_ms,
                date_added,
                last_played,
                play_count,
                file_mtime,
                available
            FROM tracks
            ORDER BY title;
            ",
        )
        .map_err(|error| error.to_string())?;

    let tracks = statement
        .query_map([], |row| {
            Ok(TrackRow {
                id: row.get(0)?,
                content_key: row.get(1)?,
                file_path: row.get(2)?,
                title: row.get(3)?,
                artist_id: row.get(4)?,
                album_id: row.get(5)?,
                genre: row.get(6)?,
                track_number: row.get(7)?,
                disc_number: row.get(8)?,
                duration_ms: row.get(9)?,
                date_added: row.get(10)?,
                last_played: row.get(11)?,
                play_count: row.get(12)?,
                file_mtime: row.get(13)?,
                available: row.get(14)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<TrackRow>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(tracks)
}

pub fn update_track(
    connection: &Connection,
    track_id: i64,
    title: &str,
    artist_id: Option<i64>,
    album_id: Option<i64>,
    genre: Option<&str>,
    track_number: Option<i64>,
    disc_number: Option<i64>,
) -> Result<(), String> {
    let rows_affected = connection
        .execute(
            "
            UPDATE tracks
            SET title = ?1,
                artist_id = ?2,
                album_id = ?3,
                genre = ?4,
                track_number = ?5,
                disc_number = ?6
            WHERE id = ?7
            ",
            params![
                title,
                artist_id,
                album_id,
                genre,
                track_number,
                disc_number,
                track_id
            ],
        )
        .map_err(|error| error.to_string())?;

    if rows_affected == 0 {
        return Err(format!(
            "Track with ID {} was not found",
            track_id
        ));
    }

    Ok(())
}

pub fn delete_track(
    connection: &Connection,
    track_id: i64,
) -> Result<(), String> {
    let rows_affected = connection
        .execute(
            "DELETE FROM tracks WHERE id = ?1",
            params![track_id],
        )
        .map_err(|error| error.to_string())?;

    if rows_affected == 0 {
        return Err(format!(
            "Track with ID {} was not found",
            track_id
        ));
    }

    Ok(())
}

// ============================================================
// Track File Queries
// ============================================================

const TRACK_FILE_COLUMNS: &str = "
    id,
    track_id,
    file_path,
    file_mtime,
    available,
    date_added,
    content_key,
    full_hash
";

fn map_track_file_row(row: &rusqlite::Row) -> rusqlite::Result<TrackFileRow> {
    Ok(TrackFileRow {
        id: row.get(0)?,
        track_id: row.get(1)?,
        file_path: row.get(2)?,
        file_mtime: row.get(3)?,
        available: row.get(4)?,
        date_added: row.get(5)?,
        content_key: row.get(6)?,
        full_hash: row.get(7)?,
    })
}

/// Register a physical file path for an existing logical track.
///
/// Returns `true` if a new path was inserted.
/// Returns `false` if the path is already registered.
///
/// The UNIQUE constraint on file_path ensures a path cannot be
/// registered more than once.
pub fn register_track_file(
    connection: &Connection,
    track_id: i64,
    file_path: &str,
    file_mtime: i64,
    date_added: i64,
    content_key: &str,
    full_hash: Option<&str>,
) -> Result<bool, String> {
    let rows_inserted = connection
        .execute(
            "
            INSERT OR IGNORE INTO track_files (
                track_id,
                file_path,
                file_mtime,
                available,
                date_added,
                content_key,
                full_hash
            )
            VALUES (?1, ?2, ?3, 1, ?4, ?5, ?6)
            ",
            params![
                track_id,
                file_path,
                file_mtime,
                date_added,
                content_key,
                full_hash
            ],
        )
        .map_err(|error| error.to_string())?;

    Ok(rows_inserted > 0)
}

/// Update a registered physical file's path or availability metadata.
pub fn update_track_file(
    connection: &Connection,
    file_id: i64,
    file_path: &str,
    file_mtime: i64,
    available: bool,
) -> Result<(), String> {
    let existing: Option<(i64, String)> = connection.query_row(
        "SELECT track_id, file_path FROM track_files WHERE id = ?1",
        params![file_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).optional().map_err(|error| error.to_string())?;
    let Some((track_id, old_path)) = existing else {
        return Err(format!("Physical file with ID {} was not found", file_id));
    };
    let changed = connection.execute(
        "UPDATE track_files SET file_path = ?1, file_mtime = ?2, available = ?3 WHERE id = ?4",
        params![file_path, file_mtime, available as i64, file_id],
    ).map_err(|error| error.to_string())?;
    if changed == 0 { return Err(format!("Physical file with ID {} was not found", file_id)); }
    connection.execute(
        "UPDATE tracks SET file_path = ?1, file_mtime = ?2, available = ?3 WHERE id = ?4 AND file_path = ?5",
        params![file_path, file_mtime, available as i64, track_id, old_path],
    ).map_err(|error| error.to_string())?;
    Ok(())
}

/// Remove a physical-file record and refresh its logical track availability.
pub fn delete_track_file(connection: &Connection, file_id: i64) -> Result<(), String> {
    let track_id: Option<i64> = connection.query_row(
        "SELECT track_id FROM track_files WHERE id = ?1", params![file_id], |row| row.get(0),
    ).optional().map_err(|error| error.to_string())?;
    let Some(track_id) = track_id else { return Err(format!("Physical file with ID {} was not found", file_id)); };
    connection.execute("DELETE FROM track_files WHERE id = ?1", params![file_id])
        .map_err(|error| error.to_string())?;
    connection.execute(
        "UPDATE tracks SET
            available = EXISTS(SELECT 1 FROM track_files WHERE track_id = tracks.id AND available = 1),
            file_path = COALESCE((SELECT file_path FROM track_files WHERE track_id = tracks.id AND available = 1 ORDER BY id LIMIT 1), file_path),
            file_mtime = COALESCE((SELECT file_mtime FROM track_files WHERE track_id = tracks.id AND available = 1 ORDER BY id LIMIT 1), file_mtime),
            content_key = COALESCE((SELECT content_key FROM track_files WHERE track_id = tracks.id AND available = 1 ORDER BY id LIMIT 1), content_key)
         WHERE id = ?1",
        params![track_id],
    ).map_err(|error| error.to_string())?;
    Ok(())
}

/// Mark files under a scanned root as unavailable when they were not found.
/// Records are retained so an unplugged drive or temporary outage is recoverable.
pub fn reconcile_scan_paths(
    connection: &Connection,
    root: &str,
    found_paths: &[String],
) -> Result<usize, String> {
    let tx = connection.unchecked_transaction().map_err(|error| error.to_string())?;
    let prefix = if root.ends_with(std::path::MAIN_SEPARATOR) { root.to_owned() } else { format!("{}{}", root, std::path::MAIN_SEPARATOR) };
    let mut statement = tx.prepare("SELECT id, file_path FROM track_files WHERE file_path = ?1 OR file_path LIKE ?2")
        .map_err(|error| error.to_string())?;
    let rows = statement.query_map(params![root, format!("{}%", prefix)], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?)))
        .map_err(|error| error.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())?;
    drop(statement);
    let found: std::collections::HashSet<&str> = found_paths.iter().map(String::as_str).collect();
    let mut changed = 0;
    for (id, path) in rows {
        let available = found.contains(path.as_str());
        changed += tx.execute("UPDATE track_files SET available = ?1 WHERE id = ?2 AND available != ?1", params![available as i64, id]).map_err(|error| error.to_string())?;
    }
    tx.execute(
        "UPDATE tracks SET
            available = EXISTS(SELECT 1 FROM track_files WHERE track_id = tracks.id AND available = 1),
            file_path = COALESCE((SELECT file_path FROM track_files WHERE track_id = tracks.id AND available = 1 ORDER BY id LIMIT 1), file_path),
            file_mtime = COALESCE((SELECT file_mtime FROM track_files WHERE track_id = tracks.id AND available = 1 ORDER BY id LIMIT 1), file_mtime),
            content_key = COALESCE((SELECT content_key FROM track_files WHERE track_id = tracks.id AND available = 1 ORDER BY id LIMIT 1), content_key)",
        [],
    )
        .map_err(|error| error.to_string())?;
    tx.commit().map_err(|error| error.to_string())?;
    Ok(changed)
}

/// Retrieve every physical file registered for a logical track.
pub fn get_track_files(
    connection: &Connection,
    track_id: i64,
) -> Result<Vec<TrackFileRow>, String> {
    let mut statement = connection
        .prepare(&format!(
            "
            SELECT {TRACK_FILE_COLUMNS}
            FROM track_files
            WHERE track_id = ?1
            ORDER BY file_path;
            "
        ))
        .map_err(|error| error.to_string())?;

    let files = statement
        .query_map(params![track_id], map_track_file_row)
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<TrackFileRow>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(files)
}

/// Look up a registered physical file by its exact path.
pub fn find_track_file_by_path(
    connection: &Connection,
    file_path: &str,
) -> Result<Option<TrackFileRow>, String> {
    connection
        .query_row(
            &format!(
                "
                SELECT {TRACK_FILE_COLUMNS}
                FROM track_files
                WHERE file_path = ?1
                "
            ),
            params![file_path],
            map_track_file_row,
        )
        .optional()
        .map_err(|error| error.to_string())
}

/// Retrieve every physical file sharing a partial content key.
/// These are the duplicate candidates for a newly scanned file.
pub fn find_track_files_by_content_key(
    connection: &Connection,
    content_key: &str,
) -> Result<Vec<TrackFileRow>, String> {
    let mut statement = connection
        .prepare(&format!(
            "
            SELECT {TRACK_FILE_COLUMNS}
            FROM track_files
            WHERE content_key = ?1
            ORDER BY id;
            "
        ))
        .map_err(|error| error.to_string())?;

    let files = statement
        .query_map(params![content_key], map_track_file_row)
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<TrackFileRow>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(files)
}

/// Store a lazily computed full-file hash for a registered file.
pub fn set_track_file_hash(
    connection: &Connection,
    track_file_id: i64,
    full_hash: &str,
) -> Result<(), String> {
    connection
        .execute(
            "UPDATE track_files SET full_hash = ?1 WHERE id = ?2",
            params![full_hash, track_file_id],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

/// Record new content identity for a file that changed on disk.
///
/// The legacy tracks.file_mtime / tracks.content_key columns are
/// kept in sync when this file is the track's primary file.
pub fn update_track_file_identity(
    connection: &Connection,
    track_file: &TrackFileRow,
    file_mtime: i64,
    content_key: &str,
    full_hash: &str,
) -> Result<(), String> {
    connection
        .execute(
            "
            UPDATE track_files
            SET file_mtime = ?1,
                content_key = ?2,
                full_hash = ?3,
                available = 1
            WHERE id = ?4
            ",
            params![file_mtime, content_key, full_hash, track_file.id],
        )
        .map_err(|error| error.to_string())?;

    connection
        .execute(
            "
            UPDATE tracks
            SET file_mtime = ?1,
                content_key = ?2,
                available = 1
            WHERE id = ?3
              AND file_path = ?4
            ",
            params![
                file_mtime,
                content_key,
                track_file.track_id,
                track_file.file_path
            ],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

/// Count the physical files registered for a logical track.
pub fn count_track_files(
    connection: &Connection,
    track_id: i64,
) -> Result<i64, String> {
    connection
        .query_row(
            "
            SELECT COUNT(*)
            FROM track_files
            WHERE track_id = ?1
            ",
            params![track_id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())
}
