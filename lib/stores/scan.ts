// Library scan status, shared by the rail indicator, Settings and Home.
// One subscription to the backend events feeds every view.

import { create } from 'zustand';
import { open } from '@tauri-apps/plugin-dialog';

import * as api from '@/lib/tauri/api';
import type { LibraryRoot, LibraryStats, ScanProgress } from '@/lib/tauri/types';

interface ScanStore {
  running: boolean;
  progress: ScanProgress | null;
  roots: LibraryRoot[];
  stats: LibraryStats | null;
  /** Bumped whenever library contents change; views refetch on it. */
  libraryVersion: number;
  error: string | null;

  /** Subscribe to backend events. Returns an unsubscribe function. */
  connect: () => () => void;
  refresh: () => Promise<void>;
  addFolder: () => Promise<void>;
  removeFolder: (rootId: number) => Promise<void>;
  rescan: () => Promise<void>;
  cancel: () => Promise<void>;
  clearError: () => void;
}

export const useScan = create<ScanStore>((set, get) => {
  const fail = (error: unknown) => set({ error: String(error) });

  return {
    running: false,
    progress: null,
    roots: [],
    stats: null,
    libraryVersion: 0,
    error: null,

    connect: () => {
      get().refresh();

      api
        .getScanStatus()
        .then((status) => set({ running: status.running, progress: status.progress }))
        .catch(() => {
          // Not running inside Tauri.
        });

      const subscriptions = [
        api.onScanProgress((progress) =>
          set({
            progress,
            running: progress.phase === 'discovering' || progress.phase === 'indexing',
          }),
        ),
        api.onLibraryChanged(() => {
          set((state) => ({ libraryVersion: state.libraryVersion + 1 }));
          get().refresh();
        }),
      ];

      return () => {
        subscriptions.forEach((subscription) =>
          subscription.then((unlisten) => unlisten()).catch(() => {}),
        );
      };
    },

    refresh: async () => {
      try {
        const [roots, stats] = await Promise.all([
          api.getLibraryRoots(),
          api.getLibraryStats(),
        ]);
        set({ roots, stats });
      } catch {
        // Not running inside Tauri.
      }
    },

    addFolder: async () => {
      set({ error: null });
      try {
        const path = await open({ directory: true, title: 'Choose a music folder' });
        if (typeof path !== 'string') return;
        await api.addLibraryRoot(path);
        await get().refresh();
        await get().rescan();
      } catch (error) {
        fail(error);
      }
    },

    removeFolder: async (rootId) => {
      set({ error: null });
      try {
        await api.removeLibraryRoot(rootId);
        set((state) => ({ libraryVersion: state.libraryVersion + 1 }));
        await get().refresh();
      } catch (error) {
        fail(error);
      }
    },

    rescan: async () => {
      set({ error: null });
      try {
        await api.startLibraryScan();
        set({ running: true });
      } catch (error) {
        fail(error);
      }
    },

    cancel: async () => {
      try {
        await api.cancelLibraryScan();
      } catch (error) {
        fail(error);
      }
    },

    clearError: () => set({ error: null }),
  };
});

/** 0–1 progress of the running scan, or null when idle. */
export function scanFraction(progress: ScanProgress | null): number | null {
  if (!progress || progress.total === 0) return null;
  return Math.min(1, progress.processed / progress.total);
}
