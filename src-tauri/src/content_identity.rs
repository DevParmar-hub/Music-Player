use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

const CHUNK_SIZE: usize = 64 * 1024; // 64 KB

pub fn generate_content_key(path: &Path) -> Result<String, String> {
    let mut file = File::open(path)
        .map_err(|error| format!("Failed to open file: {}", error))?;

    let file_size = file
        .metadata()
        .map_err(|error| format!("Failed to read file metadata: {}", error))?
        .len();

    let mut hasher = Sha256::new();

    // Include file size.
    hasher.update(file_size.to_le_bytes());

    // Read the first 64 KB.
    let first_size = file_size.min(CHUNK_SIZE as u64) as usize;
    let mut first_chunk = vec![0u8; first_size];

    file.read_exact(&mut first_chunk)
        .map_err(|error| format!("Failed to read beginning of file: {}", error))?;

    hasher.update(&first_chunk);

    // Read the last 64 KB.
    if file_size > CHUNK_SIZE as u64 {
        file.seek(SeekFrom::Start(file_size - CHUNK_SIZE as u64))
            .map_err(|error| format!("Failed to seek to end of file: {}", error))?;

        let mut last_chunk = vec![0u8; CHUNK_SIZE];

        file.read_exact(&mut last_chunk)
            .map_err(|error| format!("Failed to read end of file: {}", error))?;

        hasher.update(&last_chunk);
    }

    Ok(format!("{:x}", hasher.finalize()))
}