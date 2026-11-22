// Transient UI state that is not worth persisting.

import { create } from 'zustand';

import type { Track } from '@/lib/tauri/types';

interface UiStore {
  queueOpen: boolean;
  toggleQueue: () => void;
  setQueueOpen: (open: boolean) => void;

  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;

  /** Songs waiting to go into a playlist being created; null when closed. */
  newPlaylistTracks: Track[] | null;
  openNewPlaylist: (tracks: Track[]) => void;
  closeNewPlaylist: () => void;
}

export const useUi = create<UiStore>((set) => ({
  queueOpen: false,
  toggleQueue: () => set((state) => ({ queueOpen: !state.queueOpen })),
  setQueueOpen: (queueOpen) => set({ queueOpen }),

  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),

  newPlaylistTracks: null,
  openNewPlaylist: (tracks) => set({ newPlaylistTracks: tracks }),
  closeNewPlaylist: () => set({ newPlaylistTracks: null }),
}));
