use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use std::path::{Path, MAIN_SEPARATOR};

use super::queries::path_prefix_like;

// ============================================================
// Library Roots
// ============================================================
//
// The folders the user chose as their music library. Scans walk
// every root; removing a root removes its files from the library
// (never from disk).

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryRoot {
    pub id: i64,
    pub path: String,
    pub date_added: i64,
    pub track_count: i64,
}

pub fn get_roots(connection: &Connection) -> Result<Vec<LibraryRoot>, String> {
    let mut statement = connection
        .prepare(
            "
            SELECT id, path, date_added
            FROM library_roots
            ORDER BY path COLLATE NOCASE
            ",
        )
        .map_err(|error| error.to_string())?;

    // Each root needs its own escaped prefix, so count in a second
    // pass.
    let roots = statement
        .query_map([], |row| {
            Ok(LibraryRoot {
                id: row.get(0)?,
                path: row.get(1)?,
                date_added: row.get(2)?,
                track_count: 0,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<LibraryRoot>, _>>()
        .map_err(|error| error.to_string())?;

    roots
        .into_iter()
        .map(|mut root| {
            root.track_count = connection
                .query_row(
                    "
                    SELECT COUNT(DISTINCT track_id)
                    FROM track_files
                    WHERE file_path LIKE ?1 ESCAPE '!'
                    ",
                    params![path_prefix_like(&root.path)],
                    |row| row.get(0),
                )
                .map_err(|error| error.to_string())?;

            Ok(root)
        })
        .collect()
}

pub fn get_root_paths(connection: &Connection) -> Result<Vec<String>, String> {
    Ok(get_roots(connection)?
        .into_iter()
        .map(|root| root.path)
        .collect())
}

/// Add a folder to the library.
///
/// A folder already covered by an existing root is rejected. Adding
/// a parent of existing roots replaces them, since it covers them.
pub fn add_root(connection: &Connection, path: &str) -> Result<LibraryRoot, String> {
    let path = normalize_root(path);

    if !Path::new(&path).is_dir() {
        return Err(format!("Folder does not exist: {}", path));
    }

    let transaction = connection
        .unchecked_transaction()
        .map_err(|error| error.to_string())?;

    for existing in get_roots(&transaction)? {
        if is_within(&path, &existing.path) {
            return Err(format!(
                "This folder is already in your library through \"{}\"",
                existing.path
            ));
        }

        if is_within(&existing.path, &path) {
            transaction
                .execute("DELETE FROM library_roots WHERE id = ?1", params![existing.id])
                .map_err(|error| error.to_string())?;
        }
    }

    transaction
        .execute(
            "INSERT INTO library_roots (path, date_added) VALUES (?1, ?2)",
            params![path, chrono::Utc::now().timestamp_millis()],
        )
        .map_err(|error| error.to_string())?;

    let id = transaction.last_insert_rowid();

    transaction.commit().map_err(|error| error.to_string())?;

    get_roots(connection)?
        .into_iter()
        .find(|root| root.id == id)
        .ok_or_else(|| "Library folder disappeared after insert".to_owned())
}

/// Remove a folder from the library, along with every track that
/// only existed inside it. Files on disk are not touched.
pub fn remove_root(connection: &Connection, root_id: i64) -> Result<(), String> {
    let transaction = connection
        .unchecked_transaction()
        .map_err(|error| error.to_string())?;

    let path: Option<String> = transaction
        .query_row(
            "SELECT path FROM library_roots WHERE id = ?1",
            params![root_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    let Some(path) = path else {
        return Err(format!("Library folder with ID {} was not found", root_id));
    };

    transaction
        .execute(
            "DELETE FROM track_files WHERE file_path LIKE ?1 ESCAPE '!'",
            params![path_prefix_like(&path)],
        )
        .map_err(|error| error.to_string())?;

    // Tracks with copies elsewhere survive and switch to one of them.
    transaction
        .execute_batch(
            "
            DELETE FROM tracks
            WHERE id NOT IN (SELECT track_id FROM track_files);

            UPDATE tracks SET
                available = EXISTS(SELECT 1 FROM track_files WHERE track_id = tracks.id AND available = 1),
                file_path = COALESCE((SELECT file_path FROM track_files WHERE track_id = tracks.id ORDER BY available DESC, id LIMIT 1), file_path),
                file_mtime = COALESCE((SELECT file_mtime FROM track_files WHERE track_id = tracks.id ORDER BY available DESC, id LIMIT 1), file_mtime);
            ",
        )
        .map_err(|error| error.to_string())?;

    transaction
        .execute("DELETE FROM library_roots WHERE id = ?1", params![root_id])
        .map_err(|error| error.to_string())?;

    super::library::prune_orphans(&transaction)?;

    transaction.commit().map_err(|error| error.to_string())
}

// ============================================================
// Path Helpers
// ============================================================

/// Trim whitespace and trailing separators, keeping drive roots
/// such as `C:\` intact.
fn normalize_root(path: &str) -> String {
    let trimmed = path.trim();
    let without_separator = trimmed.trim_end_matches(['\\', '/']);

    if without_separator.ends_with(':') || without_separator.is_empty() {
        format!("{}{}", without_separator, MAIN_SEPARATOR)
    } else {
        without_separator.to_owned()
    }
}

/// True if `child` is `parent` or inside it. Case-insensitive, as
/// Windows paths are.
fn is_within(child: &str, parent: &str) -> bool {
    let child = child.to_lowercase();
    let parent = parent.to_lowercase();

    if child == parent {
        return true;
    }

    let parent_with_separator = if parent.ends_with(MAIN_SEPARATOR) {
        parent
    } else {
        format!("{}{}", parent, MAIN_SEPARATOR)
    };

    child.starts_with(&parent_with_separator)
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    fn nested_paths_are_detected_case_insensitively() {
        assert!(is_within(r"C:\Music\Rock", r"c:\music"));
        assert!(is_within(r"C:\Music", r"C:\Music"));
        assert!(is_within(r"D:\Songs", r"D:\"));
        assert!(!is_within(r"C:\Music2", r"C:\Music"));
    }

    #[test]
    fn roots_are_normalized() {
        assert_eq!(normalize_root(r" C:\Music\ "), r"C:\Music");
        assert_eq!(normalize_root(r"D:\"), r"D:\");
        assert_eq!(normalize_root("D:"), r"D:\");
    }
}
