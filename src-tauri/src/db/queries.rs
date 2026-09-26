use rusqlite::{params, Connection};

pub fn insert_artist(connection: &Connection, name: &str) -> Result<i64, String> {
    connection
        .execute(
            "INSERT INTO artists (name) VALUES (?1)",
            params![name],
        )
        .map_err(|error| error.to_string())?;

    Ok(connection.last_insert_rowid())
}

pub fn get_artists(connection: &Connection) -> Result<Vec<(i64, String)>, String> {
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
        return Err(format!("Album with ID {} was not found", album_id));
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
        return Err(format!("Album with ID {} was not found", album_id));
    }

    Ok(())
}

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