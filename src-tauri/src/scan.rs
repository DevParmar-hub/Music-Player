use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

use crate::artwork::ArtworkCache;
use crate::db;
use crate::indexer::{self, ScanSummary};

pub const PROGRESS_EVENT: &str = "scan-progress";
pub const LIBRARY_CHANGED_EVENT: &str = "library-changed";

const PROGRESS_INTERVAL: Duration = Duration::from_millis(100);
const MAX_REPORTED_ERRORS: usize = 50;

// ============================================================
// Progress
// ============================================================

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ScanPhase {
    Discovering,
    Indexing,
    Finished,
    Cancelled,
    Failed,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    pub phase: ScanPhase,
    /// Root currently being scanned, and its 1-based index.
    pub root: Option<String>,
    pub root_index: usize,
    pub root_count: usize,
    pub processed: usize,
    pub total: usize,
    pub current_file: Option<String>,
    pub inserted: usize,
    pub updated: usize,
    pub unchanged: usize,
    pub failed: usize,
    pub unavailable: usize,
    pub errors: Vec<String>,
    /// Set when the whole scan failed (phase = failed).
    pub message: Option<String>,
}

impl ScanProgress {
    fn new(root_count: usize) -> Self {
        Self {
            phase: ScanPhase::Discovering,
            root: None,
            root_index: 0,
            root_count,
            processed: 0,
            total: 0,
            current_file: None,
            inserted: 0,
            updated: 0,
            unchanged: 0,
            failed: 0,
            unavailable: 0,
            errors: Vec::new(),
            message: None,
        }
    }

    /// Fold a finished root's summary into the running totals.
    fn absorb(&mut self, summary: &ScanSummary) {
        self.processed += summary.processed();
        self.total += summary.files_found;
        self.inserted += summary.indexed;
        self.updated += summary.updated;
        self.unchanged += summary.already_indexed;
        self.failed += summary.failed;
        self.unavailable += summary.unavailable;

        let room = MAX_REPORTED_ERRORS.saturating_sub(self.errors.len());
        self.errors.extend(summary.errors.iter().take(room).cloned());
    }

    /// Totals so far plus the root currently in progress.
    fn with_current(&self, summary: &ScanSummary, current_file: &Path) -> Self {
        let mut progress = self.clone();
        progress.phase = ScanPhase::Indexing;
        progress.processed += summary.processed();
        progress.total += summary.files_found;
        progress.inserted += summary.indexed;
        progress.updated += summary.updated;
        progress.unchanged += summary.already_indexed;
        progress.failed += summary.failed;
        progress.current_file = Some(current_file.to_string_lossy().into_owned());
        progress.errors.clear();
        progress
    }
}

// ============================================================
// Scan State
// ============================================================

/// Managed state for the single background scan.
pub struct ScanState {
    running: AtomicBool,
    cancel_requested: AtomicBool,
    last_progress: Mutex<Option<ScanProgress>>,
    artwork: ArtworkCache,
}

impl ScanState {
    pub fn new(artwork: ArtworkCache) -> Self {
        Self {
            running: AtomicBool::new(false),
            cancel_requested: AtomicBool::new(false),
            last_progress: Mutex::new(None),
            artwork,
        }
    }

    pub fn artwork_directory(&self) -> &Path {
        self.artwork.directory()
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    pub fn request_cancel(&self) {
        self.cancel_requested.store(true, Ordering::SeqCst);
    }

    /// Latest progress, so a window opened mid-scan can catch up.
    pub fn last_progress(&self) -> Option<ScanProgress> {
        self.last_progress
            .lock()
            .ok()
            .and_then(|progress| progress.clone())
    }

    fn publish(&self, app: &AppHandle, progress: ScanProgress) {
        if let Ok(mut last) = self.last_progress.lock() {
            *last = Some(progress.clone());
        }

        if let Err(error) = app.emit(PROGRESS_EVENT, progress) {
            log::warn!("Failed to emit scan progress: {}", error);
        }
    }
}

// ============================================================
// Starting a Scan
// ============================================================

/// Scan every library root on a background thread.
///
/// Returns immediately. Progress arrives as `scan-progress` events;
/// `library-changed` is emitted once the library was modified.
pub fn start(app: AppHandle, roots: Vec<String>, database_path: PathBuf) -> Result<(), String> {
    let state = app.state::<ScanState>();

    if state
        .running
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err("A library scan is already running".to_owned());
    }

    state.cancel_requested.store(false, Ordering::SeqCst);

    let thread_app = app.clone();

    let spawned = std::thread::Builder::new()
        .name("library-scan".to_owned())
        .spawn(move || {
            let app = thread_app;
            let state = app.state::<ScanState>();

            let progress = match run(&app, &state, &roots, &database_path) {
                Ok(progress) => progress,
                Err(message) => {
                    log::error!("Library scan failed: {}", message);

                    ScanProgress {
                        phase: ScanPhase::Failed,
                        message: Some(message),
                        ..ScanProgress::new(roots.len())
                    }
                }
            };

            state.publish(&app, progress);
            state.running.store(false, Ordering::SeqCst);

            // Even a cancelled or failed scan may have indexed files.
            let _ = app.emit(LIBRARY_CHANGED_EVENT, ());
        });

    if let Err(error) = spawned {
        state.running.store(false, Ordering::SeqCst);
        return Err(format!("Failed to start library scan: {}", error));
    }

    Ok(())
}

fn run(
    app: &AppHandle,
    state: &ScanState,
    roots: &[String],
    database_path: &Path,
) -> Result<ScanProgress, String> {
    let connection = db::open_connection(database_path)?;
    let mut totals = ScanProgress::new(roots.len());

    for (index, root) in roots.iter().enumerate() {
        totals.root = Some(root.clone());
        totals.root_index = index + 1;
        totals.phase = ScanPhase::Discovering;
        state.publish(app, totals.clone());

        let mut last_emit = Instant::now();

        let result = indexer::scan_and_index_directory(
            &connection,
            Path::new(root),
            Some(&state.artwork),
            |path, summary| {
                let done = summary.processed() == summary.files_found;

                if done || last_emit.elapsed() >= PROGRESS_INTERVAL {
                    state.publish(app, totals.with_current(summary, path));
                    last_emit = Instant::now();
                }

                !state.cancel_requested.load(Ordering::SeqCst)
            },
        );

        match result {
            Ok(summary) => {
                totals.absorb(&summary);

                if summary.cancelled {
                    totals.phase = ScanPhase::Cancelled;
                    totals.current_file = None;
                    return Ok(totals);
                }
            }
            // One unreachable root (e.g. an unplugged drive) must not
            // stop the others from being scanned.
            Err(error) => {
                if totals.errors.len() < MAX_REPORTED_ERRORS {
                    totals.errors.push(format!("{}: {}", root, error));
                }
            }
        }
    }

    db::library::prune_orphans(&connection)?;

    totals.phase = ScanPhase::Finished;
    totals.current_file = None;

    Ok(totals)
}
