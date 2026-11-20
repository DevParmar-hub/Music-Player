// Typed wrappers around every Tauri command. Components call these
// instead of `invoke` so command names and argument shapes live in
// one place. Tauri maps camelCase arguments to Rust's snake_case.

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

import type {
  Album,
  Artist,
  JsonValue,
  LibraryRoot,
  LibraryStats,
  Playlist,
  PlaylistEntry,
  ScanProgress,
  ScanStatus,
  Track,
  TrackFile,
} from './types';

// ============================================================
// Library
// ============================================================

export const getTracks = () => invoke<Track[]>('get_tracks');
export const getAlbums = () => invoke<Album[]>('get_albums');
export const getArtists = () => invoke<Artist[]>('get_artists');
export const getLibraryStats = () => invoke<LibraryStats>('get_library_stats');
export const getArtworkDirectory = () => invoke<string>('get_artwork_directory');

export const getTrackFiles = (trackId: number) =>
  invoke<TrackFile[]>('get_track_files', { trackId });

export const setTrackFavorite = (trackId: number, favorite: boolean) =>
  invoke<void>('set_track_favorite', { trackId, favorite });

export const recordPlay = (trackId: number) =>
  invoke<void>('record_play', { trackId });

export const updateArtist = (artistId: number, name: string) =>
  invoke<void>('update_artist', { artistId, name });

export const deleteArtist = (artistId: number) =>
  invoke<void>('delete_artist', { artistId });

export const updateAlbum = (albumId: number, title: string, artistId: number | null) =>
  invoke<void>('update_album', { albumId, title, artistId });

export const deleteAlbum = (albumId: number) =>
  invoke<void>('delete_album', { albumId });

export const updateTrackFile = (
  fileId: number,
  filePath: string,
  fileMtime: number,
  available: boolean,
) => invoke<void>('update_track_file', { fileId, filePath, fileMtime, available });

export const deleteTrackFile = (fileId: number) =>
  invoke<void>('delete_track_file', { fileId });

// ============================================================
// Library Folders and Scanning
// ============================================================

export const getLibraryRoots = () => invoke<LibraryRoot[]>('get_library_roots');

export const addLibraryRoot = (path: string) =>
  invoke<LibraryRoot>('add_library_root', { path });

export const removeLibraryRoot = (rootId: number) =>
  invoke<void>('remove_library_root', { rootId });

export const startLibraryScan = () => invoke<void>('start_library_scan');
export const cancelLibraryScan = () => invoke<void>('cancel_library_scan');
export const getScanStatus = () => invoke<ScanStatus>('get_scan_status');

export const onScanProgress = (
  handler: (progress: ScanProgress) => void,
): Promise<UnlistenFn> =>
  listen<ScanProgress>('scan-progress', (event) => handler(event.payload));

/** Fires after a scan finishes, is cancelled or fails. */
export const onLibraryChanged = (handler: () => void): Promise<UnlistenFn> =>
  listen('library-changed', () => handler());

// ============================================================
// Playlists
// ============================================================

export const getPlaylists = () => invoke<Playlist[]>('get_playlists');

export const getPlaylist = (playlistId: number) =>
  invoke<Playlist>('get_playlist', { playlistId });

export const getPlaylistEntries = (playlistId: number) =>
  invoke<PlaylistEntry[]>('get_playlist_entries', { playlistId });

export const createPlaylist = (name: string, description?: string) =>
  invoke<Playlist>('create_playlist', { name, description: description ?? null });

export const updatePlaylist = (playlistId: number, name: string, description?: string) =>
  invoke<Playlist>('update_playlist', {
    playlistId,
    name,
    description: description ?? null,
  });

export const deletePlaylist = (playlistId: number) =>
  invoke<void>('delete_playlist', { playlistId });

/** Insert at `insertAt` (0-based), or append when omitted. */
export const addTracksToPlaylist = (
  playlistId: number,
  trackIds: number[],
  insertAt?: number,
) =>
  invoke<void>('add_tracks_to_playlist', {
    playlistId,
    trackIds,
    insertAt: insertAt ?? null,
  });

export const removePlaylistEntries = (playlistId: number, entryIds: number[]) =>
  invoke<void>('remove_playlist_entries', { playlistId, entryIds });

export const movePlaylistEntry = (playlistId: number, entryId: number, toIndex: number) =>
  invoke<void>('move_playlist_entry', { playlistId, entryId, toIndex });

// ============================================================
// Settings
// ============================================================

export const getSettings = () => invoke<Record<string, JsonValue>>('get_settings');

export const setSetting = (key: string, value: JsonValue) =>
  invoke<void>('set_setting', { key, value });
