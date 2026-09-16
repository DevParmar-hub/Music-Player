use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

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

        let connection = Connection::open(&database_path)
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

        Ok(Self {
            connection: Mutex::new(connection),
            path: database_path,
        })
    }
}