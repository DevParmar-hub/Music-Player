mod db;

use tauri::{Manager, State};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Response from Rust.", name)
}

#[tauri::command]
fn verify_database(state: State<'_, db::Database>) -> Result<String, String> {
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
            AND name NOT LIKE 'sqlite_%'
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
        "Database connected successfully\nPath: {}\nTables: {:?}",
        state.path.display(),
        tables
    ))
}

#[tauri::command]
fn test_insert_artist(
    state: State<'_, db::Database>,
    name: String,
) -> Result<String, String> {
    let connection = state
        .connection
        .lock()
        .map_err(|error| error.to_string())?;

    let artist_id = db::queries::insert_artist(&connection, &name)?;

    Ok(format!(
        "Artist inserted successfully\nID: {}\nName: {}",
        artist_id, name
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

    let artists = db::queries::get_artists(&connection)?;

    Ok(format!("{:?}", artists))
}

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

    let album_id = db::queries::insert_album(
        &connection,
        &title,
        artist_id,
    )?;

    Ok(format!(
        "Album inserted successfully\nID: {}\nTitle: {}\nArtist ID: {:?}",
        album_id,
        title,
        artist_id
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

    let albums = db::queries::get_albums(&connection)?;

    Ok(format!("{:?}", albums))
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
        "Album updated successfully\nID: {}\nTitle: {}\nArtist ID: {:?}",
        album_id,
        title,
        artist_id
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

    db::queries::delete_album(&connection, album_id)?;

    Ok(format!(
        "Album deleted successfully\nID: {}",
        album_id
    ))
}

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

    let track_id = db::queries::insert_track(
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
        "Track inserted successfully\nID: {}\nTitle: {}\nPath: {}",
        track_id,
        title,
        file_path
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

    let tracks = db::queries::get_tracks(&connection)?;

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
        "Track updated successfully\nID: {}\nTitle: {}\nGenre: {}",
        track_id,
        title,
        genre.as_deref().unwrap_or("None")
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

    db::queries::delete_track(&connection, track_id)?;

    Ok(format!(
        "Track deleted successfully\nID: {}",
        track_id
    ))
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let database = db::Database::new(&app.handle())
                .map_err(std::io::Error::other)?;

            app.manage(database);

            Ok(())
        })
.invoke_handler(tauri::generate_handler![
    greet,
    verify_database,
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
])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}