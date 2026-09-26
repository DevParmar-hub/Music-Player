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
    test_insert_artist
])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}