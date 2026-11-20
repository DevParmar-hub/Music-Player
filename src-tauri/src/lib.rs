mod artwork;
mod commands;
mod content_identity;
mod db;
mod indexer;
mod metadata;
mod scan;
mod scanner;

use tauri::Manager;

use commands::{library, playlists, roots, settings};

// ============================================================
// Application Entry Point
// ============================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let database = db::Database::new(app.handle())?;

            // Artwork lives in local data, not the cache directory:
            // the database refers to it, so OS cleanup must not
            // delete it.
            let artwork_directory = app.path().app_local_data_dir()?.join("artwork");
            let artwork = artwork::ArtworkCache::new(artwork_directory)?;

            roots::allow_asset_access(app.handle(), &artwork.directory().to_string_lossy());

            for root in db::roots::get_root_paths(&*database.lock()?)? {
                roots::allow_asset_access(app.handle(), &root);
            }

            app.manage(database);
            app.manage(scan::ScanState::new(artwork));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            library::get_tracks,
            library::get_albums,
            library::get_artists,
            library::get_library_stats,
            library::get_track_files,
            library::get_artwork_directory,
            library::set_track_favorite,
            library::record_play,
            library::update_artist,
            library::delete_artist,
            library::update_album,
            library::delete_album,
            library::update_track_file,
            library::delete_track_file,
            roots::get_library_roots,
            roots::add_library_root,
            roots::remove_library_root,
            roots::start_library_scan,
            roots::cancel_library_scan,
            roots::get_scan_status,
            playlists::get_playlists,
            playlists::get_playlist,
            playlists::get_playlist_entries,
            playlists::create_playlist,
            playlists::update_playlist,
            playlists::delete_playlist,
            playlists::add_tracks_to_playlist,
            playlists::remove_playlist_entries,
            playlists::move_playlist_entry,
            settings::get_settings,
            settings::set_setting,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
