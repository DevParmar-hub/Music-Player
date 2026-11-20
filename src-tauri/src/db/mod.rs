pub(crate) mod migrations;
pub mod library;
pub mod playlists;
pub mod queries;
pub mod roots;
pub mod settings;

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

use rusqlite::Connection;
use tauri::{AppHandle, Manager};

pub struct Database {
    pub connection: Mutex<Connection>,
    pub path: PathBuf,
}

impl Database {
    pub fn new(app: &AppHandle) -> Result<Self, String> {
        let app_data_dir = app
            .path()
            .app_data_dir()
            .map_err(|error| error.to_string())?;

        fs::create_dir_all(&app_data_dir)
            .map_err(|error| error.to_string())?;

        let database_path = app_data_dir.join("music_player.db");

        let connection = open_connection(&database_path)?;

        migrations::run_migrations(&connection)?;

        Ok(Self {
            connection: Mutex::new(connection),
            path: database_path,
        })
    }

    pub fn lock(&self) -> Result<MutexGuard<'_, Connection>, String> {
        self.connection.lock().map_err(|error| error.to_string())
    }
}

/// Open a connection with the pragmas every connection needs.
///
/// Long-running jobs (library scans) open their own connection so
/// the UI's connection is never blocked behind them. WAL mode lets
/// readers continue while a scan writes.
pub fn open_connection(path: &Path) -> Result<Connection, String> {
    let connection = Connection::open(path)
        .map_err(|error| error.to_string())?;

    connection
        .execute_batch(
            "
            PRAGMA foreign_keys = ON;
            PRAGMA journal_mode = WAL;
            PRAGMA busy_timeout = 5000;
            ",
        )
        .map_err(|error| error.to_string())?;

    Ok(connection)
}
