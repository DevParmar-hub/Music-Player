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

    let result: i32 = connection
        .query_row("SELECT 1", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;

    if result != 1 {
        return Err("SQLite SELECT 1 returned an unexpected result.".to_string());
    }

    Ok(format!(
        "Database connected successfully\nPath: {}",
        state.path.display()
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
            verify_database
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}