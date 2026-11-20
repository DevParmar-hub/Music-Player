// Transient UI state that is not worth persisting.

import { create } from 'zustand';

interface UiStore {
  queueOpen: boolean;
  toggleQueue: () => void;
  setQueueOpen: (open: boolean) => void;
}

export const useUi = create<UiStore>((set) => ({
  queueOpen: false,
  toggleQueue: () => set((state) => ({ queueOpen: !state.queueOpen })),
  setQueueOpen: (queueOpen) => set({ queueOpen }),
}));
