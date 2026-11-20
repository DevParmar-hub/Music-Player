use serde_json::Value;
use std::collections::HashMap;
use tauri::State;

use crate::db::settings;
use crate::db::Database;

#[tauri::command]
pub fn get_settings(database: State<'_, Database>) -> Result<HashMap<String, Value>, String> {
    settings::get_settings(&*database.lock()?)
}

#[tauri::command]
pub fn set_setting(database: State<'_, Database>, key: String, value: Value) -> Result<(), String> {
    settings::set_setting(&*database.lock()?, &key, &value)
}
