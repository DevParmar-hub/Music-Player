'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import {
  ListMusic,
  LoaderCircle,
  Maximize2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
} from 'lucide-react';

import { Artwork } from '@/components/player/Artwork';
import { LikeButton } from '@/components/player/LikeButton';
import { PlayingBars } from '@/components/player/PlayingBars';
import { SeekBar } from '@/components/player/SeekBar';
import { VolumeSlider } from '@/components/player/VolumeSlider';
import { IconButton } from '@/components/ui/Button';
import { useCurrentTrack, usePlayer } from '@/lib/player/store';
import { useUi } from '@/lib/stores/ui';

const REPEAT_LABELS = {
  off: 'Repeat: off',
  all: 'Repeat: all songs',
  one: 'Repeat: this song',
} as const;

/** The always-visible mini player. */
export function PlayerBar() {
  const track = useCurrentTrack();
  const playing = usePlayer((state) => state.playing);
  const loading = usePlayer((state) => state.loading);
  const shuffle = usePlayer((state) => state.shuffle);
  const repeat = usePlayer((state) => state.repeat);
  const togglePlay = usePlayer((state) => state.togglePlay);
  const next = usePlayer((state) => state.next);
  const previous = usePlayer((state) => state.previous);
  const toggleShuffle = usePlayer((state) => state.toggleShuffle);
  const cycleRepeat = usePlayer((state) => state.cycleRepeat);
  const queueOpen = useUi((state) => state.queueOpen);
  const toggleQueue = useUi((state) => state.toggleQueue);

  const hasTrack = track !== null;

  return (
    <footer
      aria-label="Player"
      className="relative z-10 grid h-[84px] grid-cols-[1fr_minmax(0,560px)_1fr] items-center gap-6 border-t border-border bg-surface/75 px-5 backdrop-blur-xl"
    >
      {/* Track */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-xl shadow-float">
          <AnimatePresence initial={false}>
            <motion.div
              key={track?.id ?? 'empty'}
              initial={{ opacity: 0, scale: 1.08 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0"
            >
              <Artwork hash={track?.artworkHash ?? null} className="size-full" />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-fg">
            {hasTrack && <PlayingBars playing={playing} className="shrink-0" />}
            {track?.albumId != null ? (
              <Link href={`/album?id=${track.albumId}`} className="truncate hover:underline">
                {track.title}
              </Link>
            ) : (
              <span className="truncate">{track?.title ?? 'Nothing playing'}</span>
            )}
          </span>
          <span className="truncate text-xs text-fg-muted">
            {!track ? (
              'Pick a song to start listening'
            ) : track.artistId !== null ? (
              <Link href={`/artist?id=${track.artistId}`} className="hover:text-fg hover:underline">
                {track.artistName}
              </Link>
            ) : (
              'Unknown artist'
            )}
          </span>
        </div>

        <LikeButton track={track} />
      </div>

      {/* Transport */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2">
          <IconButton
            label={shuffle ? 'Shuffle: on' : 'Shuffle: off'}
            aria-pressed={shuffle}
            active={shuffle}
            size="sm"
            disabled={!hasTrack}
            onClick={toggleShuffle}
          >
            <Shuffle className="size-4" />
          </IconButton>
          <IconButton label="Previous" disabled={!hasTrack} onClick={previous}>
            <SkipBack className="size-[18px] fill-current" />
          </IconButton>
          <IconButton
            label={playing ? 'Pause' : 'Play'}
            size="lg"
            variant="primary"
            disabled={!hasTrack}
            onClick={togglePlay}
            className="shadow-[0_6px_20px_-8px_var(--accent)]"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={loading && playing ? 'loading' : playing ? 'pause' : 'play'}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex"
              >
                {loading && playing ? (
                  <LoaderCircle className="size-5 animate-spin" />
                ) : playing ? (
                  <Pause className="size-5 fill-current" />
                ) : (
                  <Play className="ml-0.5 size-5 fill-current" />
                )}
              </motion.span>
            </AnimatePresence>
          </IconButton>
          <IconButton label="Next" disabled={!hasTrack} onClick={next}>
            <SkipForward className="size-[18px] fill-current" />
          </IconButton>
          <IconButton
            label={REPEAT_LABELS[repeat]}
            aria-pressed={repeat !== 'off'}
            active={repeat !== 'off'}
            size="sm"
            disabled={!hasTrack}
            onClick={cycleRepeat}
          >
            {repeat === 'one' ? <Repeat1 className="size-4" /> : <Repeat className="size-4" />}
          </IconButton>
        </div>
        <SeekBar />
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
        <VolumeSlider />
        <IconButton label="Now Playing arrives in Stage 4" disabled className="ml-1">
          <Maximize2 className="size-[18px]" />
        </IconButton>
      </div>
    </footer>
  );
}
