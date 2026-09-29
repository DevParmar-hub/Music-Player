mod db;
mod metadata;
mod scanner;
mod content_identity;
mod indexer;

use tauri::{Manager, State};

// ============================================================
// Basic Rust Test
// ============================================================

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// ============================================================
// Database Verification
// ============================================================

#[tauri::command]
fn verify_database(
    state: State<'_, db::Database>,
) -> Result<String, String> {
    let connection = state
        .connection
        .lock()
        .map_err(|error| error.to_string())?;

    let mut statement = connection
        .prepare(
            "
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
            ORDER BY name;
            ",
        )
        .map_err(|error| error.to_string())?;

    let tables = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<String>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(format!(
        "Database connected successfully\n\
         Path: {}\n\
         Tables: {:?}",
        state.path.display(),
        tables
    ))
}

// ============================================================
// Music Scanner
// ============================================================

#[tauri::command]
fn scan_music_directory(
    path: String,
) -> Result<Vec<String>, String> {
    let root = std::path::Path::new(&path);

    if !root.exists() {
        return Err(format!(
            "Directory does not exist: {}",
            path
        ));
    }

    if !root.is_dir() {
        return Err(format!(
            "Path is not a directory: {}",
            path
        ));
    }

    let tracks = scanner::scan_directory(root)?;

    Ok(tracks
        .into_iter()
        .map(|path| path.to_string_lossy().into_owned())
        .collect())
}

// ============================================================
// Metadata Test
// ============================================================

#[tauri::command]
fn test_read_metadata(
    path: String,
) -> Result<String, String> {
    let metadata = metadata::read_metadata(
        std::path::Path::new(&path),
    )?;

    Ok(format!("{:#?}", metadata))
}

// ============================================================
// Content Key Test
// ============================================================

#[tauri::command]
fn test_content_key(
    path: String,
) -> Result<String, String> {
    content_identity::generate_content_key(
        std::path::Path::new(&path),
    )
}

// ============================================================
// Library Indexer
// ============================================================

#[tauri::command]
fn index_music_track(
    app: tauri::AppHandle,
    path: String,
) -> Result<String, String> {
    let database = app.state::<db::Database>();

    let connection = database
        .connection
        .lock()
        .map_err(|error| error.to_string())?;

    let result = indexer::index_track(
        &connection,
        std::path::Path::new(&path),
    )?;

    Ok(result)
}

// ============================================================
// Artist Tests
// ============================================================

#[tauri::command]
fn test_insert_artist(
    state: State<'_, db::Database>,
    name: String,
) -> Result<String, String> {
    let connection = state
        .connection
        .lock()
        .map_err(|error| error.to_string())?;

    let id = db::queries::insert_artist(
        &connection,
        &name,
    )?;

    Ok(format!(
        "Artist inserted successfully with ID: {}",
        id
    ))
}

#[tauri::command]
fn test_get_artists(
    state: State<'_, db::Database>,
) -> Result<String, String> {
    let connection = state
        .connection
        .lock()
        .map_err(|error| error.to_string())?;

    let artists =
        db::queries::get_artists(&connection)?;

    Ok(format!("{:#?}", artists))
}

// ============================================================
// Album Tests
// ============================================================

#[tauri::command]
fn test_insert_album(
    state: State<'_, db::Database>,
    title: String,
    artist_id: Option<i64>,
) -> Result<String, String> {
    let connection = state
        .connection
        .lock()
        .map_err(|error| error.to_string())?;

    let id = db::queries::insert_album(
        &connection,
        &title,
        artist_id,
    )?;

    Ok(format!(
        "Album inserted successfully with ID: {}",
        id
    ))
}

#[tauri::command]
fn test_get_albums(
    state: State<'_, db::Database>,
) -> Result<String, String> {
    let connection = state
        .connection
        .lock()
        .map_err(|error| error.to_string())?;

    let albums =
        db::queries::get_albums(&connection)?;

    Ok(format!("{:#?}", albums))
}

#[tauri::command]
fn test_update_album(
    state: State<'_, db::Database>,
    album_id: i64,
    title: String,
    artist_id: Option<i64>,
) -> Result<String, String> {
    let connection = state
        .connection
        .lock()
        .map_err(|error| error.to_string())?;

    db::queries::update_album(
        &connection,
        album_id,
        &title,
        artist_id,
    )?;

    Ok(format!(
        "Album {} updated successfully",
        album_id
    ))
}

#[tauri::command]
fn test_delete_album(
    state: State<'_, db::Database>,
    album_id: i64,
) -> Result<String, String> {
    let connection = state
        .connection
        .lock()
        .map_err(|error| error.to_string())?;

    db::queries::delete_album(
        &connection,
        album_id,
    )?;

    Ok(format!(
        "Album {} deleted successfully",
        album_id
    ))
}

// ============================================================
// Track Tests
// ============================================================

#[tauri::command]
fn test_insert_track(
    state: State<'_, db::Database>,
    content_key: String,
    file_path: String,
    title: String,
    artist_id: Option<i64>,
    album_id: Option<i64>,
    genre: Option<String>,
    track_number: Option<i64>,
    disc_number: Option<i64>,
    duration_ms: i64,
    date_added: i64,
    file_mtime: i64,
) -> Result<String, String> {
    let connection = state
        .connection
        .lock()
        .map_err(|error| error.to_string())?;

    let id = db::queries::insert_track(
        &connection,
        &content_key,
        &file_path,
        &title,
        artist_id,
        album_id,
        genre.as_deref(),
        track_number,
        disc_number,
        duration_ms,
        date_added,
        file_mtime,
    )?;

    Ok(format!(
        "Track inserted successfully with ID: {}",
        id
    ))
}

#[tauri::command]
fn test_get_tracks(
    state: State<'_, db::Database>,
) -> Result<String, String> {
    let connection = state
        .connection
        .lock()
        .map_err(|error| error.to_string())?;

    let tracks =
        db::queries::get_tracks(&connection)?;

    Ok(format!("{:#?}", tracks))
}

#[tauri::command]
fn test_update_track(
    state: State<'_, db::Database>,
    track_id: i64,
    title: String,
    artist_id: Option<i64>,
    album_id: Option<i64>,
    genre: Option<String>,
    track_number: Option<i64>,
    disc_number: Option<i64>,
) -> Result<String, String> {
    let connection = state
        .connection
        .lock()
        .map_err(|error| error.to_string())?;

    db::queries::update_track(
        &connection,
        track_id,
        &title,
        artist_id,
        album_id,
        genre.as_deref(),
        track_number,
        disc_number,
    )?;

    Ok(format!(
        "Track {} updated successfully",
        track_id
    ))
}

#[tauri::command]
fn test_delete_track(
    state: State<'_, db::Database>,
    track_id: i64,
) -> Result<String, String> {
    let connection = state
        .connection
        .lock()
        .map_err(|error| error.to_string())?;

    db::queries::delete_track(
        &connection,
        track_id,
    )?;

    Ok(format!(
        "Track {} deleted successfully",
        track_id
    ))
}

// ============================================================
// Application Entry Point
// ============================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let database =
                db::Database::new(&app.handle())?;

            app.manage(database);

            Ok(())
        })
        .invoke_handler(
            tauri::generate_handler![
                greet,
                verify_database,
                scan_music_directory,
                test_read_metadata,
                test_content_key,
                index_music_track,
                test_insert_artist,
                test_get_artists,
                test_insert_album,
                test_get_albums,
                test_update_album,
                test_delete_album,
                test_insert_track,
                test_get_tracks,
                test_update_track,
                test_delete_track
            ],
        )
        .run(tauri::generate_context!())
        .expect(
            "error while running tauri application",
        );
}