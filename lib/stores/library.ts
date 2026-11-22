// The library as the UI sees it: every track, album, artist and
// playlist, loaded once and refreshed after scans. Small changes
// (likes, play counts) are patched in place instead of refetching.

import { create } from 'zustand';

import * as api from '@/lib/tauri/api';
import type { Album, Artist, Playlist, Track } from '@/lib/tauri/types';

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface LibraryStore {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
  playlists: Playlist[];
  status: Status;
  error: string | null;

  load: () => Promise<void>;
  loadPlaylists: () => Promise<void>;
  patchTrack: (trackId: number, patch: Partial<Track>) => void;
}

export const useLibrary = create<LibraryStore>((set, get) => ({
  tracks: [],
  albums: [],
  artists: [],
  playlists: [],
  status: 'idle',
  error: null,

  load: async () => {
    // Keep showing the current data while a refresh is in flight.
    if (get().status !== 'ready') set({ status: 'loading' });
    try {
      const [tracks, albums, artists, playlists] = await Promise.all([
        api.getTracks(),
        api.getAlbums(),
        api.getArtists(),
        api.getPlaylists(),
      ]);
      set({ tracks, albums, artists, playlists, status: 'ready', error: null });
    } catch (error) {
      set({ status: 'error', error: String(error) });
    }
  },

  loadPlaylists: async () => {
    try {
      set({ playlists: await api.getPlaylists() });
    } catch (error) {
      console.warn('Could not load playlists:', error);
    }
  },

  patchTrack: (trackId, patch) =>
    set((state) => ({
      tracks: state.tracks.map((track) => (track.id === trackId ? { ...track, ...patch } : track)),
    })),
}));
