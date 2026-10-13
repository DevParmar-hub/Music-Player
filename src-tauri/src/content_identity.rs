use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

const CHUNK_SIZE: usize = 64 * 1024; // 64 KB

pub fn generate_content_key(path: &Path) -> Result<String, String> {
    println!("[Content Key] Requested path: {}", path.display());

    let mut file = File::open(path).map_err(|error| {
        format!(
            "Failed to open file '{}': {}",
            path.display(),
            error
        )
    })?;

    let file_size = file
        .metadata()
        .map_err(|error| error.to_string())?
        .len();

    println!("[Content Key] File size: {} bytes", file_size);

    let mut hasher = Sha256::new();

    hasher.update(file_size.to_le_bytes());

    let first_size = file_size.min(CHUNK_SIZE as u64) as usize;
    let mut first_chunk = vec![0u8; first_size];

    file.read_exact(&mut first_chunk)
        .map_err(|error| error.to_string())?;

    hasher.update(&first_chunk);

    if file_size > CHUNK_SIZE as u64 {
        file.seek(SeekFrom::Start(file_size - CHUNK_SIZE as u64))
            .map_err(|error| error.to_string())?;

        let mut last_chunk = vec![0u8; CHUNK_SIZE];

        file.read_exact(&mut last_chunk)
            .map_err(|error| error.to_string())?;

        hasher.update(&last_chunk);
    }

    let content_key = format!("{:x}", hasher.finalize());

    println!("[Content Key] Result: {}", content_key);

    Ok(content_key)
}