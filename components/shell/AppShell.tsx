'use client';

import { useEffect, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';

import { NewPlaylistDialog } from '@/components/library/NewPlaylistDialog';
import { Toaster } from '@/components/ui/Toaster';
import { connectMediaSession } from '@/lib/player/mediaSession';
import { startSession } from '@/lib/player/session';
import { connectShortcuts } from '@/lib/player/shortcuts';
import { initPlayer } from '@/lib/player/store';
import { useLibrary } from '@/lib/stores/library';
import { useScan } from '@/lib/stores/scan';
import { resolveTheme, useSettings } from '@/lib/stores/settings';
import { CommandPalette } from './CommandPalette';
import { NavRail } from './NavRail';
import { PlayerBar } from './PlayerBar';
import { QueueDrawer } from './QueueDrawer';

/**
 * Persistent frame around every page: rail, content, queue drawer and
 * player bar. Also owns app-wide effects: settings, theme, scan events,
 * the player session, media keys and shortcuts.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const theme = useSettings((state) => state.theme);
  const motionLevel = useSettings((state) => state.motion);

  useEffect(() => {
    useSettings.getState().hydrate();
    initPlayer();

    const disconnectScan = useScan.getState().connect();

    // Load the library now, and again whenever a scan changes it.
    useLibrary.getState().load();
    const stopLibraryRefresh = useScan.subscribe((state, previous) => {
      if (state.libraryVersion !== previous.libraryVersion) useLibrary.getState().load();
    });
    const disconnectMediaSession = connectMediaSession();
    const disconnectShortcuts = connectShortcuts();

    // Restore the last queue (paused), then keep saving it.
    let cancelled = false;
    let endSession: (() => void) | null = null;
    startSession().then((stop) => {
      if (cancelled) stop();
      else endSession = stop;
    });

    return () => {
      cancelled = true;
      disconnectScan();
      stopLibraryRefresh();
      disconnectMediaSession();
      disconnectShortcuts();
      endSession?.();
    };
  }, []);

  // Apply the theme, following the OS while set to "system".
  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(theme);
    };

    apply();

    if (theme !== 'system') return;

    const query = window.matchMedia('(prefers-color-scheme: light)');
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.motion = motionLevel;
  }, [motionLevel]);

  return (
    <MotionConfig reducedMotion={motionLevel === 'off' ? 'always' : 'user'}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-fg"
      >
        Skip to content
      </a>

      <div className="grid h-dvh grid-rows-[minmax(0,1fr)_auto]">
        <div className="flex min-h-0">
          <NavRail />
          <div className="relative min-w-0 flex-1">
            <main id="main" className="h-full overflow-y-auto">
              {children}
            </main>
            <QueueDrawer />
          </div>
        </div>
        <PlayerBar />
      </div>
      <Toaster />
      <CommandPalette />
      <NewPlaylistDialog />
    </MotionConfig>
  );
}
