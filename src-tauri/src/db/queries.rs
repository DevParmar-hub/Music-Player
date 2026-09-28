use rusqlite::{params, Connection};

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