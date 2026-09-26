use rusqlite::Connection;

pub fn run_migrations(connection: &Connection) -> Result<(), String> {
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

    Ok(())
}