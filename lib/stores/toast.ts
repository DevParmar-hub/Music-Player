// Short, non-blocking messages ("Couldn't play X, skipped").
// Later stages add an action button for undo.

import { create } from 'zustand';

export type ToastTone = 'neutral' | 'error';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  action?: { label: string; run: () => void };
}

const DURATION_MS = 4500;
const MAX_VISIBLE = 3;

interface ToastStore {
  toasts: Toast[];
  show: (message: string, options?: { tone?: ToastTone; action?: Toast['action'] }) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToasts = create<ToastStore>((set, get) => ({
  toasts: [],

  show: (message, options = {}) => {
    const toast: Toast = { id: nextId++, message, tone: options.tone ?? 'neutral', action: options.action };
    set((state) => ({ toasts: [...state.toasts, toast].slice(-MAX_VISIBLE) }));
    window.setTimeout(() => get().dismiss(toast.id), DURATION_MS);
  },

  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

/** Show a toast from outside React. */
export const toast = (message: string, options?: Parameters<ToastStore['show']>[1]) =>
  useToasts.getState().show(message, options);
