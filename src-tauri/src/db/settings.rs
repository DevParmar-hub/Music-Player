use rusqlite::{params, Connection};
use serde_json::Value;
use std::collections::HashMap;

// ============================================================
// Settings
// ============================================================
//
// A key/value store for user preferences (theme, now-playing mode,
// motion level, ...). Values are JSON so the UI owns their shape and
// defaults; the backend only persists them.

pub fn get_settings(connection: &Connection) -> Result<HashMap<String, Value>, String> {
    let mut statement = connection
        .prepare("SELECT key, value FROM settings")
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    let mut settings = HashMap::with_capacity(rows.len());

    for (key, raw) in rows {
        match serde_json::from_str(&raw) {
            Ok(value) => {
                settings.insert(key, value);
            }
            Err(error) => log::warn!("Ignoring unreadable setting '{}': {}", key, error),
        }
    }

    Ok(settings)
}

pub fn set_setting(connection: &Connection, key: &str, value: &Value) -> Result<(), String> {
    if key.trim().is_empty() {
        return Err("Setting key cannot be empty".to_owned());
    }

    connection
        .execute(
            "
            INSERT INTO settings (key, value) VALUES (?1, ?2)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            ",
            params![key, value.to_string()],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}
