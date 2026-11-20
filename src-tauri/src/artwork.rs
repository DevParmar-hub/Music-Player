use image::codecs::jpeg::JpegEncoder;
use image::imageops::FilterType;
use image::GenericImageView;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

const FULL_MAX_SIZE: u32 = 1200;
const THUMB_SIZE: u32 = 320;

/// File names (without extension) commonly used for folder artwork.
const FOLDER_ART_NAMES: &[&str] = &["cover", "folder", "front", "album", "albumart"];
const FOLDER_ART_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp"];

// ============================================================
// Artwork Cache
// ============================================================

/// Stores cover images on disk, keyed by the SHA-256 of the source
/// bytes, so albums sharing a cover are stored once.
///
/// Every image is written as `<hash>.jpg` (at most 1200px) and
/// `<hash>-thumb.jpg` (320px), which the UI loads through the asset
/// protocol.
pub struct ArtworkCache {
    directory: PathBuf,
}

impl ArtworkCache {
    pub fn new(directory: PathBuf) -> Result<Self, String> {
        fs::create_dir_all(&directory).map_err(|error| {
            format!(
                "Failed to create artwork directory '{}': {}",
                directory.display(),
                error
            )
        })?;

        Ok(Self { directory })
    }

    pub fn directory(&self) -> &Path {
        &self.directory
    }

    /// Store an image and return its hash. Already-cached images are
    /// not decoded again.
    pub fn store(&self, bytes: &[u8]) -> Result<String, String> {
        let hash = format!("{:x}", Sha256::digest(bytes));

        let full_path = self.directory.join(format!("{hash}.jpg"));
        let thumb_path = self.directory.join(format!("{hash}-thumb.jpg"));

        if full_path.is_file() && thumb_path.is_file() {
            return Ok(hash);
        }

        let image = image::load_from_memory(bytes)
            .map_err(|error| format!("Unreadable artwork: {}", error))?;

        let (width, height) = image.dimensions();
        let is_jpeg = bytes.starts_with(&[0xFF, 0xD8, 0xFF]);

        // A JPEG that is already small enough is kept byte-for-byte.
        if is_jpeg && width <= FULL_MAX_SIZE && height <= FULL_MAX_SIZE {
            write_atomically(&full_path, bytes)?;
        } else {
            let full = if width > FULL_MAX_SIZE || height > FULL_MAX_SIZE {
                image.resize(FULL_MAX_SIZE, FULL_MAX_SIZE, FilterType::Lanczos3)
            } else {
                image.clone()
            };

            write_atomically(&full_path, &encode_jpeg(&full, 90)?)?;
        }

        let thumb = image.thumbnail(THUMB_SIZE, THUMB_SIZE);
        write_atomically(&thumb_path, &encode_jpeg(&thumb, 85)?)?;

        Ok(hash)
    }
}

fn encode_jpeg(image: &image::DynamicImage, quality: u8) -> Result<Vec<u8>, String> {
    let mut buffer = Vec::new();

    image
        .to_rgb8()
        .write_with_encoder(JpegEncoder::new_with_quality(&mut buffer, quality))
        .map_err(|error| error.to_string())?;

    Ok(buffer)
}

/// Write via a temporary file so the UI never loads a half-written
/// image.
fn write_atomically(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let temporary = path.with_extension("tmp");

    fs::write(&temporary, bytes)
        .and_then(|_| fs::rename(&temporary, path))
        .map_err(|error| {
            let _ = fs::remove_file(&temporary);
            format!("Failed to write artwork '{}': {}", path.display(), error)
        })
}

// ============================================================
// Folder Artwork
// ============================================================

/// Look for a cover image (cover.jpg, folder.png, ...) in the
/// track's directory. Used when the file has no embedded picture.
pub fn find_folder_artwork(track_path: &Path) -> Option<Vec<u8>> {
    let directory = track_path.parent()?;

    let entries = fs::read_dir(directory).ok()?;

    let mut best: Option<(usize, PathBuf)> = None;

    for entry in entries.flatten() {
        let path = entry.path();

        let (Some(stem), Some(extension)) = (
            path.file_stem().and_then(|value| value.to_str()),
            path.extension().and_then(|value| value.to_str()),
        ) else {
            continue;
        };

        let is_image = FOLDER_ART_EXTENSIONS
            .iter()
            .any(|supported| extension.eq_ignore_ascii_case(supported));

        let rank = FOLDER_ART_NAMES
            .iter()
            .position(|name| stem.eq_ignore_ascii_case(name));

        if let (true, Some(rank)) = (is_image, rank) {
            if best.as_ref().map_or(true, |(best_rank, _)| rank < *best_rank) {
                best = Some((rank, path));
            }
        }
    }

    best.and_then(|(_, path)| fs::read(path).ok())
}
