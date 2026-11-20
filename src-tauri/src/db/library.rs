use rusqlite::{params, Connection, Row};
use serde::Serialize;

// ============================================================
// Library DTOs
// ============================================================
//
// These are the shapes the UI receives. Keep them in sync with
// lib/tauri/types.ts.

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub id: i64,
    pub title: String,
    pub artist_id: Option<i64>,
    pub artist_name: Option<String>,
    pub album_id: Option<i64>,
    pub album_title: Option<String>,
    pub genre: Option<String>,
    pub track_number: Option<i64>,
    pub disc_number: Option<i64>,
    pub year: Option<i64>,
    pub duration_ms: i64,
    pub date_added: i64,
    pub last_played: Option<i64>,
    pub play_count: i64,
    pub favorite: bool,
    pub available: bool,
    pub file_path: String,
    pub artwork_hash: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Album {
    pub id: i64,
    pub title: String,
    pub artist_id: Option<i64>,
    pub artist_name: Option<String>,
    pub track_count: i64,
    pub duration_ms: i64,
    pub year: Option<i64>,
    pub artwork_hash: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Artist {
    pub id: i64,
    pub name: String,
    pub album_count: i64,
    pub track_count: i64,
    pub artwork_hash: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryStats {
    pub track_count: i64,
    pub album_count: i64,
    pub artist_count: i64,
    pub total_duration_ms: i64,
    pub unavailable_count: i64,
    pub schema_version: i64,
}

// ============================================================
// Tracks
// ============================================================

/// Columns read by `map_track`, in order. Other modules join extra
/// columns after these.
pub(crate) const TRACK_SELECT: &str = "
    SELECT
        t.id,
        t.title,
        t.artist_id,
        ar.name,
        t.album_id,
        al.title,
        t.genre,
        t.track_number,
        t.disc_number,
        t.year,
        t.duration_ms,
        t.date_added,
        t.last_played,
        t.play_count,
        t.favorite,
        t.available,
        t.file_path,
        NULLIF(t.artwork_hash, '')
    FROM tracks t
    LEFT JOIN artists ar ON ar.id = t.artist_id
    LEFT JOIN albums al ON al.id = t.album_id
";

pub(crate) const TRACK_COLUMN_COUNT: usize = 18;

pub(crate) fn map_track(row: &Row) -> rusqlite::Result<Track> {
    Ok(Track {
        id: row.get(0)?,
        title: row.get(1)?,
        artist_id: row.get(2)?,
        artist_name: row.get(3)?,
        album_id: row.get(4)?,
        album_title: row.get(5)?,
        genre: row.get(6)?,
        track_number: row.get(7)?,
        disc_number: row.get(8)?,
        year: row.get(9)?,
        duration_ms: row.get(10)?,
        date_added: row.get(11)?,
        last_played: row.get(12)?,
        play_count: row.get(13)?,
        favorite: row.get(14)?,
        available: row.get(15)?,
        file_path: row.get(16)?,
        artwork_hash: row.get(17)?,
    })
}

/// Every track, sorted by title. The UI virtualizes and re-sorts
/// the list itself, so one round trip serves every library view.
pub fn get_tracks(connection: &Connection) -> Result<Vec<Track>, String> {
    let mut statement = connection
        .prepare(&format!("{TRACK_SELECT} ORDER BY t.title COLLATE NOCASE"))
        .map_err(|error| error.to_string())?;

    let tracks = statement
        .query_map([], map_track)
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<Track>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(tracks)
}

pub fn set_track_favorite(
    connection: &Connection,
    track_id: i64,
    favorite: bool,
) -> Result<(), String> {
    let changed = connection
        .execute(
            "UPDATE tracks SET favorite = ?1 WHERE id = ?2",
            params![favorite, track_id],
        )
        .map_err(|error| error.to_string())?;

    if changed == 0 {
        return Err(format!("Track with ID {} was not found", track_id));
    }

    Ok(())
}

/// Count a play and remember when it happened.
pub fn record_play(connection: &Connection, track_id: i64) -> Result<(), String> {
    let changed = connection
        .execute(
            "
            UPDATE tracks
            SET play_count = play_count + 1,
                last_played = ?1
            WHERE id = ?2
            ",
            params![chrono::Utc::now().timestamp_millis(), track_id],
        )
        .map_err(|error| error.to_string())?;

    if changed == 0 {
        return Err(format!("Track with ID {} was not found", track_id));
    }

    Ok(())
}

// ============================================================
// Albums and Artists
// ============================================================

/// Albums that still have tracks, with the artwork of their first
/// track that has any.
pub fn get_albums(connection: &Connection) -> Result<Vec<Album>, String> {
    let mut statement = connection
        .prepare(
            "
            SELECT
                al.id,
                al.title,
                al.artist_id,
                ar.name,
                COUNT(t.id),
                COALESCE(SUM(t.duration_ms), 0),
                MAX(t.year),
                (
                    SELECT art.artwork_hash
                    FROM tracks art
                    WHERE art.album_id = al.id
                      AND art.artwork_hash <> ''
                    ORDER BY art.disc_number, art.track_number
                    LIMIT 1
                )
            FROM albums al
            JOIN tracks t ON t.album_id = al.id
            LEFT JOIN artists ar ON ar.id = al.artist_id
            GROUP BY al.id
            ORDER BY al.title COLLATE NOCASE
            ",
        )
        .map_err(|error| error.to_string())?;

    let albums = statement
        .query_map([], |row| {
            Ok(Album {
                id: row.get(0)?,
                title: row.get(1)?,
                artist_id: row.get(2)?,
                artist_name: row.get(3)?,
                track_count: row.get(4)?,
                duration_ms: row.get(5)?,
                year: row.get(6)?,
                artwork_hash: row.get(7)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<Album>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(albums)
}

/// Artists that still have tracks. Their artwork is taken from
/// their most played track that has any.
pub fn get_artists(connection: &Connection) -> Result<Vec<Artist>, String> {
    let mut statement = connection
        .prepare(
            "
            SELECT
                ar.id,
                ar.name,
                COUNT(DISTINCT t.album_id),
                COUNT(t.id),
                (
                    SELECT art.artwork_hash
                    FROM tracks art
                    WHERE art.artist_id = ar.id
                      AND art.artwork_hash <> ''
                    ORDER BY art.play_count DESC
                    LIMIT 1
                )
            FROM artists ar
            JOIN tracks t ON t.artist_id = ar.id
            GROUP BY ar.id
            ORDER BY ar.name COLLATE NOCASE
            ",
        )
        .map_err(|error| error.to_string())?;

    let artists = statement
        .query_map([], |row| {
            Ok(Artist {
                id: row.get(0)?,
                name: row.get(1)?,
                album_count: row.get(2)?,
                track_count: row.get(3)?,
                artwork_hash: row.get(4)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<Artist>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(artists)
}

// ============================================================
// Maintenance
// ============================================================

pub fn get_library_stats(connection: &Connection) -> Result<LibraryStats, String> {
    connection
        .query_row(
            "
            SELECT
                (SELECT COUNT(*) FROM tracks),
                (SELECT COUNT(DISTINCT album_id) FROM tracks),
                (SELECT COUNT(DISTINCT artist_id) FROM tracks),
                (SELECT COALESCE(SUM(duration_ms), 0) FROM tracks),
                (SELECT COUNT(*) FROM tracks WHERE available = 0),
                (SELECT user_version FROM pragma_user_version)
            ",
            [],
            |row| {
                Ok(LibraryStats {
                    track_count: row.get(0)?,
                    album_count: row.get(1)?,
                    artist_count: row.get(2)?,
                    total_duration_ms: row.get(3)?,
                    unavailable_count: row.get(4)?,
                    schema_version: row.get(5)?,
                })
            },
        )
        .map_err(|error| error.to_string())
}

/// Delete albums and artists that no track refers to any more,
/// e.g. after tags were edited or a library folder was removed.
pub fn prune_orphans(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "
            DELETE FROM albums
            WHERE id NOT IN (
                SELECT album_id FROM tracks WHERE album_id IS NOT NULL
            );

            DELETE FROM artists
            WHERE id NOT IN (
                SELECT artist_id FROM tracks WHERE artist_id IS NOT NULL
            )
              AND id NOT IN (
                SELECT artist_id FROM albums WHERE artist_id IS NOT NULL
            );
            ",
        )
        .map_err(|error| error.to_string())
}
