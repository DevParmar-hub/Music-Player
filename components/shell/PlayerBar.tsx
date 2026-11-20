'use client';

import {
  Heart,
  ListMusic,
  Maximize2,
  Music2,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
} from 'lucide-react';

import { IconButton } from '@/components/ui/Button';
import { useUi } from '@/lib/stores/ui';

/**
 * The always-visible mini player. Stage 1 lays it out in its empty
 * state; the playback engine (Stage 2) feeds it a track and makes the
 * controls live.
 */
export function PlayerBar() {
  const queueOpen = useUi((state) => state.queueOpen);
  const toggleQueue = useUi((state) => state.toggleQueue);

  // Wired up by the playback engine in Stage 2.
  const track = null as null | { title: string; artist: string };
  const playing = false;
  const hasTrack = track !== null;

  return (
    <footer
      aria-label="Player"
      className="relative z-10 grid h-[84px] grid-cols-[1fr_minmax(0,560px)_1fr] items-center gap-6 border-t border-border bg-surface/75 px-5 backdrop-blur-xl"
    >
      {/* Track */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-surface-3 text-fg-subtle">
          <Music2 className="size-5" />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-fg">
            {track?.title ?? 'Nothing playing'}
          </span>
          <span className="truncate text-xs text-fg-muted">
            {track?.artist ?? 'Pick a song to start listening'}
          </span>
        </div>
        <IconButton label="Like" size="sm" disabled={!hasTrack} className="ml-1">
          <Heart className="size-4" />
        </IconButton>
      </div>

      {/* Transport */}
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-2">
          <IconButton label="Shuffle" size="sm" disabled={!hasTrack}>
            <Shuffle className="size-4" />
          </IconButton>
          <IconButton label="Previous" disabled={!hasTrack}>
            <SkipBack className="size-[18px] fill-current" />
          </IconButton>
          <IconButton
            label={playing ? 'Pause' : 'Play'}
            size="lg"
            variant="primary"
            disabled={!hasTrack}
          >
            {playing ? (
              <Pause className="size-5 fill-current" />
            ) : (
              <Play className="ml-0.5 size-5 fill-current" />
            )}
          </IconButton>
          <IconButton label="Next" disabled={!hasTrack}>
            <SkipForward className="size-[18px] fill-current" />
          </IconButton>
          <IconButton label="Repeat" size="sm" disabled={!hasTrack}>
            <Repeat className="size-4" />
          </IconButton>
        </div>
        <div className="flex w-full items-center gap-3 text-[11px] tabular-nums text-fg-subtle">
          <span className="w-9 text-right">0:00</span>
          <div className="h-1 flex-1 rounded-full bg-surface-3" />
          <span className="w-9">0:00</span>
        </div>
      </div>

      {/* Extras */}
      <div className="flex items-center justify-end gap-1">
        <IconButton
          label={queueOpen ? 'Hide queue' : 'Show queue'}
          active={queueOpen}
          onClick={toggleQueue}
          aria-pressed={queueOpen}
        >
          <ListMusic className="size-[18px]" />
        </IconButton>
        <div className="flex items-center gap-2 pl-1">
          <Volume2 className="size-[18px] text-fg-muted" aria-hidden="true" />
          <div className="h-1 w-24 rounded-full bg-surface-3">
            <div className="h-full w-3/4 rounded-full bg-fg-muted" />
          </div>
        </div>
        <IconButton label="Open Now Playing" disabled={!hasTrack} className="ml-1">
          <Maximize2 className="size-[18px]" />
        </IconButton>
      </div>
    </footer>
  );
}
