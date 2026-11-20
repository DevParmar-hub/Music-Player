// Mirrors of the Rust DTOs (src-tauri/src/db/*.rs, src-tauri/src/scan.rs).
// Rust serializes with camelCase, so field names match one-to-one.
// Timestamps are Unix milliseconds.

export interface Track {
  id: number;
  title: string;
  artistId: number | null;
  artistName: string | null;
  albumId: number | null;
  albumTitle: string | null;
  genre: string | null;
  trackNumber: number | null;
  discNumber: number | null;
  year: number | null;
  durationMs: number;
  dateAdded: number;
  lastPlayed: number | null;
  playCount: number;
  favorite: boolean;
  available: boolean;
  filePath: string;
  artworkHash: string | null;
}

export interface Album {
  id: number;
  title: string;
  artistId: number | null;
  artistName: string | null;
  trackCount: number;
  durationMs: number;
  year: number | null;
  artworkHash: string | null;
}

export interface Artist {
  id: number;
  name: string;
  albumCount: number;
  trackCount: number;
  artworkHash: string | null;
}

export interface LibraryStats {
  trackCount: number;
  albumCount: number;
  artistCount: number;
  totalDurationMs: number;
  unavailableCount: number;
  schemaVersion: number;
}

export interface TrackFile {
  id: number;
  trackId: number;
  filePath: string;
  fileMtime: number;
  /** 1 when the file was found on the last scan, 0 otherwise. */
  available: number;
  dateAdded: number;
  contentKey: string | null;
  fullHash: string | null;
}

export interface LibraryRoot {
  id: number;
  path: string;
  dateAdded: number;
  trackCount: number;
}

export interface Playlist {
  id: number;
  name: string;
  description: string | null;
  syncToFolder: boolean;
  folderPath: string | null;
  createdAt: number;
  updatedAt: number;
  trackCount: number;
  durationMs: number;
  /** Up to four distinct covers, for the playlist mosaic. */
  artworkHashes: string[];
}

export interface PlaylistEntry {
  /** Identifies this occurrence; a track may appear more than once. */
  entryId: number;
  position: number;
  addedAt: number;
  track: Track;
}

export type ScanPhase =
  | 'discovering'
  | 'indexing'
  | 'finished'
  | 'cancelled'
  | 'failed';

export interface ScanProgress {
  phase: ScanPhase;
  root: string | null;
  /** 1-based index of the root being scanned. */
  rootIndex: number;
  rootCount: number;
  processed: number;
  total: number;
  currentFile: string | null;
  inserted: number;
  updated: number;
  unchanged: number;
  failed: number;
  unavailable: number;
  errors: string[];
  message: string | null;
}

export interface ScanStatus {
  running: boolean;
  progress: ScanProgress | null;
}

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
