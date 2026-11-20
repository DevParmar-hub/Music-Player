// User preferences. The database is the source of truth; the theme
// is also mirrored to localStorage so the pre-paint script in
// layout.tsx can apply it before the first frame.

import { create } from 'zustand';

import * as api from '@/lib/tauri/api';
import type { JsonValue } from '@/lib/tauri/types';

export type ThemePreference = 'system' | 'dark' | 'light';
export type NowPlayingMode = 'vinyl' | 'studio';
export type MotionLevel = 'full' | 'calm' | 'off';

export interface Settings {
  theme: ThemePreference;
  nowPlayingMode: NowPlayingMode;
  motion: MotionLevel;
  railCollapsed: boolean;
}

export const THEME_STORAGE_KEY = 'theme';

const DEFAULTS: Settings = {
  theme: 'system',
  nowPlayingMode: 'vinyl',
  motion: 'full',
  railCollapsed: false,
};

// Values read from the database are validated, so a stale or
// hand-edited row can never put the UI in an impossible state.
const ALLOWED: { [K in keyof Settings]: readonly Settings[K][] } = {
  theme: ['system', 'dark', 'light'],
  nowPlayingMode: ['vinyl', 'studio'],
  motion: ['full', 'calm', 'off'],
  railCollapsed: [true, false],
};

interface SettingsStore extends Settings {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

export const useSettings = create<SettingsStore>((set) => ({
  ...DEFAULTS,
  hydrated: false,

  hydrate: async () => {
    try {
      const stored = await api.getSettings();
      const valid: Partial<Settings> = {};

      for (const key of Object.keys(ALLOWED) as (keyof Settings)[]) {
        const value = stored[key];
        if ((ALLOWED[key] as readonly JsonValue[]).includes(value)) {
          Object.assign(valid, { [key]: value });
        }
      }

      set({ ...valid, hydrated: true });
      if (valid.theme) rememberTheme(valid.theme);
    } catch (error) {
      // Outside Tauri (plain browser) there is no backend; keep defaults.
      console.warn('Settings unavailable, using defaults:', error);
      set({ hydrated: true });
    }
  },

  update: (key, value) => {
    set({ [key]: value } as Pick<Settings, typeof key>);
    if (key === 'theme') rememberTheme(value as ThemePreference);

    api.setSetting(key, value).catch((error) => {
      console.error(`Failed to save setting "${key}":`, error);
    });
  },
}));

function rememberTheme(theme: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable; the database still has it.
  }
}

/** The theme actually shown, resolving "system". */
export function resolveTheme(theme: ThemePreference): 'dark' | 'light' {
  if (theme !== 'system') return theme;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
