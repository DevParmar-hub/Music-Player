//! Tauri commands, grouped by area. Every command returns
//! serializable data (never preformatted strings) so the UI can render
//! it directly. TypeScript mirrors live in lib/tauri/types.ts.

pub mod library;
pub mod playlists;
pub mod roots;
pub mod settings;
