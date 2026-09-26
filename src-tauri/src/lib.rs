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
    test_delete_album
])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}