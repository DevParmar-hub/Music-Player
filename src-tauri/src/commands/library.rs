use tauri::State;

use crate::db::library::{self, Album, Artist, LibraryStats, Track};
use crate::db::queries::{self, TrackFileRow};
use crate::db::Database;
use crate::scan::ScanState;

// ============================================================
// Reading the Library
// ============================================================

#[tauri::command]
pub fn get_tracks(database: State<'_, Database>) -> Result<Vec<Track>, String> {
    library::get_tracks(&*database.lock()?)
}

#[tauri::command]
pub fn get_albums(database: State<'_, Database>) -> Result<Vec<Album>, String> {
    library::get_albums(&*database.lock()?)
}

#[tauri::command]
pub fn get_artists(database: State<'_, Database>) -> Result<Vec<Artist>, String> {
    library::get_artists(&*database.lock()?)
}

#[tauri::command]
pub fn get_library_stats(database: State<'_, Database>) -> Result<LibraryStats, String> {
    library::get_library_stats(&*database.lock()?)
}

#[tauri::command]
pub fn get_track_files(
    database: State<'_, Database>,
    track_id: i64,
) -> Result<Vec<TrackFileRow>, String> {
    queries::get_track_files(&*database.lock()?, track_id)
}

/// Where cover images are cached; the UI builds asset URLs from it.
#[tauri::command]
pub fn get_artwork_directory(scan: State<'_, ScanState>) -> String {
    scan.artwork_directory().to_string_lossy().into_owned()
}

// ============================================================
// Listening Activity
// ============================================================

#[tauri::command]
pub fn set_track_favorite(
    database: State<'_, Database>,
    track_id: i64,
    favorite: bool,
) -> Result<(), String> {
    library::set_track_favorite(&*database.lock()?, track_id, favorite)
}

#[tauri::command]
pub fn record_play(database: State<'_, Database>, track_id: i64) -> Result<(), String> {
    library::record_play(&*database.lock()?, track_id)
}

// ============================================================
// Editing Artists, Albums and Files
// ============================================================

#[tauri::command]
pub fn update_artist(
    database: State<'_, Database>,
    artist_id: i64,
    name: String,
) -> Result<(), String> {
    queries::update_artist(&*database.lock()?, artist_id, &name)
}

#[tauri::command]
pub fn delete_artist(database: State<'_, Database>, artist_id: i64) -> Result<(), String> {
    queries::delete_artist(&*database.lock()?, artist_id)
}

#[tauri::command]
pub fn update_album(
    database: State<'_, Database>,
    album_id: i64,
    title: String,
    artist_id: Option<i64>,
) -> Result<(), String> {
    queries::update_album(&*database.lock()?, album_id, &title, artist_id)
}

#[tauri::command]
pub fn delete_album(database: State<'_, Database>, album_id: i64) -> Result<(), String> {
    queries::delete_album(&*database.lock()?, album_id)
}

#[tauri::command]
pub fn update_track_file(
    database: State<'_, Database>,
    file_id: i64,
    file_path: String,
    file_mtime: i64,
    available: bool,
) -> Result<(), String> {
    queries::update_track_file(&*database.lock()?, file_id, &file_path, file_mtime, available)
}

#[tauri::command]
pub fn delete_track_file(database: State<'_, Database>, file_id: i64) -> Result<(), String> {
    queries::delete_track_file(&*database.lock()?, file_id)
}
