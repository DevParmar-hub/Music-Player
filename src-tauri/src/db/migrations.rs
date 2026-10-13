
use rusqlite::Connection;

pub fn run_migrations(connection: &Connection) -> Result<(), String> {
    // Create the base schema if this is a new database.
    // Existing tables and data are left intact.
    connection
        .execute_batch(
            "
            CREATE TABLE IF NOT EXISTS artists (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE
            );

            CREATE TABLE IF NOT EXISTS albums (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                artist_id INTEGER
                    REFERENCES artists(id)
                    ON DELETE SET NULL,
                UNIQUE(title, artist_id)
            );

            CREATE TABLE IF NOT EXISTS tracks (
                id INTEGER PRIMARY KEY,
                content_key TEXT NOT NULL,
                file_path TEXT NOT NULL UNIQUE,
                title TEXT NOT NULL,
                artist_id INTEGER
                    REFERENCES artists(id)
                    ON DELETE SET NULL,
                album_id INTEGER
                    REFERENCES albums(id)
                    ON DELETE SET NULL,
                genre TEXT,
                track_number INTEGER,
                disc_number INTEGER,
                duration_ms INTEGER NOT NULL,
                date_added INTEGER NOT NULL,
                last_played INTEGER,
                play_count INTEGER NOT NULL DEFAULT 0,
                file_mtime INTEGER NOT NULL,
                available INTEGER NOT NULL DEFAULT 1
            );

            CREATE INDEX IF NOT EXISTS idx_tracks_content_key
                ON tracks(content_key);

            CREATE INDEX IF NOT EXISTS idx_tracks_last_played
                ON tracks(last_played);

            CREATE INDEX IF NOT EXISTS idx_tracks_play_count
                ON tracks(play_count);
            ",
        )
        .map_err(|error| error.to_string())?;

    // Migration 1: track_files
    let version: i64 = connection
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;

    if version < 1 {
        connection
            .execute_batch(
                "
                BEGIN IMMEDIATE;

                CREATE TABLE IF NOT EXISTS track_files (
                    id INTEGER PRIMARY KEY,
                    track_id INTEGER NOT NULL
                        REFERENCES tracks(id)
                        ON DELETE CASCADE,
                    file_path TEXT NOT NULL UNIQUE,
                    file_mtime INTEGER NOT NULL,
                    available INTEGER NOT NULL DEFAULT 1,
                    date_added INTEGER NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_track_files_track_id
                    ON track_files(track_id);

                INSERT OR IGNORE INTO track_files (
                    track_id,
                    file_path,
                    file_mtime,
                    available,
                    date_added
                )
                SELECT
                    id,
                    file_path,
                    file_mtime,
                    available,
                    date_added
                FROM tracks;

                PRAGMA user_version = 1;

                COMMIT;
                ",
            )
            .map_err(|error| {
                // If the migration failed before COMMIT, roll back
                // its schema and data changes.
                let _ = connection.execute_batch("ROLLBACK;");
                error.to_string()
            })?;
    }

    Ok(())
}
