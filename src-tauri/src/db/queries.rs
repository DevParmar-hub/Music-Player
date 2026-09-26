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