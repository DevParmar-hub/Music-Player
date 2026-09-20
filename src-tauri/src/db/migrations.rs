use rusqlite::Connection;

pub fn run_migrations(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "
            CREATE TABLE IF NOT EXISTS artists (
                id INTEGER PRIMARY KEY
            );
            ",
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}