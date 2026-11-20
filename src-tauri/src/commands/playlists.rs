use tauri::State;

use crate::db::playlists::{self, Playlist, PlaylistEntry};
use crate::db::Database;

#[tauri::command]
pub fn get_playlists(database: State<'_, Database>) -> Result<Vec<Playlist>, String> {
    playlists::get_playlists(&*database.lock()?)
}

#[tauri::command]
pub fn get_playlist(database: State<'_, Database>, playlist_id: i64) -> Result<Playlist, String> {
    playlists::get_playlist(&*database.lock()?, playlist_id)
}

#[tauri::command]
pub fn get_playlist_entries(
    database: State<'_, Database>,
    playlist_id: i64,
) -> Result<Vec<PlaylistEntry>, String> {
    playlists::get_playlist_entries(&*database.lock()?, playlist_id)
}

#[tauri::command]
pub fn create_playlist(
    database: State<'_, Database>,
    name: String,
    description: Option<String>,
) -> Result<Playlist, String> {
    playlists::create_playlist(&*database.lock()?, &name, description.as_deref())
}

#[tauri::command]
pub fn update_playlist(
    database: State<'_, Database>,
    playlist_id: i64,
    name: String,
    description: Option<String>,
) -> Result<Playlist, String> {
    playlists::update_playlist(&*database.lock()?, playlist_id, &name, description.as_deref())
}

#[tauri::command]
pub fn delete_playlist(database: State<'_, Database>, playlist_id: i64) -> Result<(), String> {
    playlists::delete_playlist(&*database.lock()?, playlist_id)
}

#[tauri::command]
pub fn add_tracks_to_playlist(
    database: State<'_, Database>,
    playlist_id: i64,
    track_ids: Vec<i64>,
    insert_at: Option<usize>,
) -> Result<(), String> {
    playlists::add_tracks(&*database.lock()?, playlist_id, &track_ids, insert_at)
}

#[tauri::command]
pub fn remove_playlist_entries(
    database: State<'_, Database>,
    playlist_id: i64,
    entry_ids: Vec<i64>,
) -> Result<(), String> {
    playlists::remove_entries(&*database.lock()?, playlist_id, &entry_ids)
}

#[tauri::command]
pub fn move_playlist_entry(
    database: State<'_, Database>,
    playlist_id: i64,
    entry_id: i64,
    to_index: usize,
) -> Result<(), String> {
    playlists::move_entry(&*database.lock()?, playlist_id, entry_id, to_index)
}
