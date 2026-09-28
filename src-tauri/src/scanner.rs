use std::fs;
use std::path::{Path, PathBuf};

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "mp3",
    "flac",
    "wav",
    "m4a",
    "aac",
    "ogg",
    "opus",
    "wma",
    "mpeg",
];

pub fn scan_directory(root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut tracks = Vec::new();

    scan_directory_recursive(root, &mut tracks)?;

    Ok(tracks)
}

fn scan_directory_recursive(
    directory: &Path,
    tracks: &mut Vec<PathBuf>,
) -> Result<(), String> {
    let entries = fs::read_dir(directory)
        .map_err(|error| {
            format!(
                "Failed to read directory '{}': {}",
                directory.display(),
                error
            )
        })?;

    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;

        let path = entry.path();

        if path.is_dir() {
            scan_directory_recursive(&path, tracks)?;
        } else if path.is_file() && is_supported_audio_file(&path) {
            tracks.push(path);
        }
    }

    Ok(())
}

fn is_supported_audio_file(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| {
            SUPPORTED_EXTENSIONS
                .iter()
                .any(|supported| extension.eq_ignore_ascii_case(supported))
        })
        .unwrap_or(false)
}