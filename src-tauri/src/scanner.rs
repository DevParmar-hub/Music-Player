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

/// Result of walking a directory tree.
pub struct DirectoryScan {
    pub files: Vec<PathBuf>,
    /// Subdirectories that could not be read. They are skipped
    /// instead of failing the whole scan.
    pub errors: Vec<String>,
}

pub fn scan_directory(root: &Path) -> Result<DirectoryScan, String> {
    let mut scan = DirectoryScan {
        files: Vec::new(),
        errors: Vec::new(),
    };

    // The root itself must be readable; anything below it is
    // best-effort.
    fs::read_dir(root).map_err(|error| {
        format!(
            "Failed to read directory '{}': {}",
            root.display(),
            error
        )
    })?;

    scan_directory_recursive(root, &mut scan);

    Ok(scan)
}

fn scan_directory_recursive(directory: &Path, scan: &mut DirectoryScan) {
    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(error) => {
            scan.errors.push(format!(
                "Skipped unreadable directory '{}': {}",
                directory.display(),
                error
            ));
            return;
        }
    };

    for entry in entries.flatten() {
        let path = entry.path();

        let Ok(file_type) = entry.file_type() else {
            continue;
        };

        // Symlinked directories are not followed, so a link pointing
        // back up the tree can never cause an endless walk.
        if file_type.is_dir() {
            scan_directory_recursive(&path, scan);
        } else if (file_type.is_file() || (file_type.is_symlink() && path.is_file()))
            && is_supported_audio_file(&path)
        {
            scan.files.push(path);
        }
    }
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
