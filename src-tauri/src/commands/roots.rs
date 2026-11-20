use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use crate::db::roots::{self, LibraryRoot};
use crate::db::Database;
use crate::scan::{self, ScanProgress, ScanState};

// ============================================================
// Library Folders
// ============================================================

#[tauri::command]
pub fn get_library_roots(database: State<'_, Database>) -> Result<Vec<LibraryRoot>, String> {
    roots::get_roots(&*database.lock()?)
}

/// Add a folder and let the UI stream audio and read files from it.
/// The caller starts a scan afterwards.
#[tauri::command]
pub fn add_library_root(
    app: AppHandle,
    database: State<'_, Database>,
    path: String,
) -> Result<LibraryRoot, String> {
    let root = roots::add_root(&*database.lock()?, &path)?;

    allow_asset_access(&app, &root.path);

    Ok(root)
}

#[tauri::command]
pub fn remove_library_root(
    database: State<'_, Database>,
    scan: State<'_, ScanState>,
    root_id: i64,
) -> Result<(), String> {
    if scan.is_running() {
        return Err("Wait for the current scan to finish before removing a folder".to_owned());
    }

    roots::remove_root(&*database.lock()?, root_id)
}

/// Grant the asset protocol read access to a folder so its audio
/// files can be played.
pub fn allow_asset_access(app: &AppHandle, path: &str) {
    if let Err(error) = app.asset_protocol_scope().allow_directory(path, true) {
        log::warn!("Could not allow asset access to '{}': {}", path, error);
    }
}

// ============================================================
// Scanning
// ============================================================

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanStatus {
    pub running: bool,
    pub progress: Option<ScanProgress>,
}

/// Scan every library folder in the background. Listen for
/// `scan-progress` and `library-changed` events.
#[tauri::command]
pub fn start_library_scan(app: AppHandle, database: State<'_, Database>) -> Result<(), String> {
    let root_paths = roots::get_root_paths(&*database.lock()?)?;

    if root_paths.is_empty() {
        return Err("Add a music folder before scanning".to_owned());
    }

    scan::start(app.clone(), root_paths, database.path.clone())
}

#[tauri::command]
pub fn cancel_library_scan(scan: State<'_, ScanState>) {
    scan.request_cancel();
}

#[tauri::command]
pub fn get_scan_status(scan: State<'_, ScanState>) -> ScanStatus {
    ScanStatus {
        running: scan.is_running(),
        progress: scan.last_progress(),
    }
}
