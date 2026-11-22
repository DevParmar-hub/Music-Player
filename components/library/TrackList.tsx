'use client';

import { memo, useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Heart, MoreHorizontal, Play } from 'lucide-react';

import { Artwork } from '@/components/player/Artwork';
import { PlayingBars } from '@/components/player/PlayingBars';
import { setFavorite } from '@/lib/actions/favorites';
import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/format';
import { usePlayer } from '@/lib/player/store';
import { toast } from '@/lib/stores/toast';
import type { Track } from '@/lib/tauri/types';
import { openMenuFrom, TrackMenu } from './TrackMenu';

/**
 * library: full columns with cover, artist, album and date added.
 * album:   track numbers, no cover; artist only when it differs.
 * compact: cover, title and artist, for shelves and short lists.
 */
export type TrackListVariant = 'library' | 'album' | 'compact';

const GRID: Record<TrackListVariant, string> = {
  library: 'grid-cols-[2.5rem_minmax(0,5fr)_minmax(0,3fr)_7rem_2rem_3.5rem_2rem] max-lg:grid-cols-[2.5rem_minmax(0,1fr)_2rem_3.5rem_2rem]',
  album: 'grid-cols-[2.5rem_minmax(0,1fr)_2rem_3.5rem_2rem]',
  compact: 'grid-cols-[2.5rem_minmax(0,1fr)_2rem_3.5rem_2rem]',
};

const ROW_HEIGHT: Record<TrackListVariant, number> = { library: 56, album: 48, compact: 56 };

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

interface ListProps {
  tracks: Track[];
  variant: TrackListVariant;
  /** Queue label when a row is played, e.g. "Album · Blue". */
  source: string;
  /** Album artist, so album rows only name guest artists. */
  albumArtistId?: number | null;
  /**
   * What to queue when a row is played, if larger than this list (e.g.
   * the whole album for one disc), and where this list starts in it.
   */
  queue?: { tracks: Track[]; offset: number };
}

// ============================================================
// Plain list (albums, artists, shelves)
// ============================================================

export function TrackList({ tracks, variant, source, albumArtistId, queue }: ListProps) {
  const currentId = usePlayer((state) => state.queue[state.index]?.track.id ?? null);
  const playing = usePlayer((state) => state.playing);
  const play = usePlayFrom(queue?.tracks ?? tracks, source, queue?.offset ?? 0);

  return (
    <div role="list" aria-label={source} className="flex flex-col">
      {variant !== 'compact' && <HeaderRow variant={variant} />}
      {tracks.map((track, index) => (
        <TrackRow
          key={`${track.id}-${index}`}
          track={track}
          index={index}
          variant={variant}
          source={source}
          current={track.id === currentId}
          playing={playing}
          showArtist={variant !== 'album' || track.artistId !== albumArtistId}
          onPlay={play}
        />
      ))}
    </div>
  );
}

// ============================================================
// Virtualized list (the Songs page)
// ============================================================

/**
 * Renders only the rows on screen. It scrolls with the page's main
 * area, so headers and controls above it scroll away naturally.
 */
export function VirtualTrackList({ tracks, variant, source }: ListProps) {
  const currentId = usePlayer((state) => state.queue[state.index]?.track.id ?? null);
  const playing = usePlayer((state) => state.playing);
  const play = usePlayFrom(tracks, source);

  const listRef = useRef<HTMLDivElement>(null);
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    // Locating the shell's scroll area is a one-off DOM read.
    setScrollElement(document.getElementById('main'));
    const measure = () => setScrollMargin(listRef.current?.offsetTop ?? 0);
    measure();
    const observer = new ResizeObserver(measure);
    if (listRef.current?.parentElement) observer.observe(listRef.current.parentElement);
    return () => observer.disconnect();
  }, []);

  // TanStack Virtual manages its own memoization.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: tracks.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => ROW_HEIGHT[variant],
    overscan: 12,
    scrollMargin,
  });

  return (
    <div role="list" aria-label={source} className="flex flex-col">
      <HeaderRow variant={variant} />
      <div ref={listRef} className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((row) => {
          const track = tracks[row.index];
          return (
            <div
              key={row.key}
              className="absolute inset-x-0 top-0"
              style={{ transform: `translateY(${row.start - scrollMargin}px)` }}
            >
              <TrackRow
                track={track}
                index={row.index}
                variant={variant}
                source={source}
                current={track.id === currentId}
                playing={playing}
                showArtist
                onPlay={play}
                setSize={tracks.length}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Pieces
// ============================================================

/** Play the list from a row. Stable, so memoized rows stay cached. */
function usePlayFrom(tracks: Track[], source: string, offset = 0) {
  return useCallback(
    (index: number) => {
      const start = offset + index;
      if (!tracks[start].available) {
        toast(`"${tracks[start].title}" can't be found on disk. Try rescanning your library.`, { tone: 'error' });
        return;
      }
      usePlayer.getState().playTracks(tracks, { startIndex: start, source });
    },
    [tracks, source, offset],
  );
}

function HeaderRow({ variant }: { variant: TrackListVariant }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'grid h-9 items-center gap-3 border-b border-border px-3 text-[11px] font-medium tracking-wider text-fg-subtle uppercase',
        GRID[variant],
      )}
    >
      <span className="text-center">#</span>
      <span>Title</span>
      {variant === 'library' && <span className="max-lg:hidden">Album</span>}
      {variant === 'library' && <span className="max-lg:hidden">Added</span>}
      <span />
      <span className="text-right">Time</span>
      <span />
    </div>
  );
}

interface RowProps {
  track: Track;
  index: number;
  variant: TrackListVariant;
  source: string;
  current: boolean;
  playing: boolean;
  showArtist: boolean;
  onPlay: (index: number) => void;
  /** Total rows, so screen readers know "12 of 4,000" when virtualized. */
  setSize?: number;
}

const TrackRow = memo(function TrackRow({
  track,
  index,
  variant,
  source,
  current,
  playing,
  showArtist,
  onPlay,
  setSize,
}: RowProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onPlay(index);
    }
  };

  const number = variant === 'album' ? (track.trackNumber ?? index + 1) : index + 1;

  return (
    <TrackMenu tracks={[track]} source={source}>
      <div
        role="listitem"
        aria-posinset={setSize ? index + 1 : undefined}
        aria-setsize={setSize}
        tabIndex={0}
        aria-label={`${track.title}${track.artistName ? ` by ${track.artistName}` : ''}`}
        aria-current={current || undefined}
        onDoubleClick={() => onPlay(index)}
        onKeyDown={onKeyDown}
        className={cn(
          'group grid items-center gap-3 rounded-xl px-3 outline-none select-none',
          'hover:bg-surface-2/70 focus-visible:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring',
          'data-[state=open]:bg-surface-2',
          GRID[variant],
          !track.available && 'opacity-45',
        )}
        style={{ height: ROW_HEIGHT[variant] }}
      >
        {/* Number, now-playing bars, or a play button on hover. */}
        <div className="relative flex justify-center text-sm text-fg-subtle tabular-nums">
          <span className="group-hover:invisible">
            {current ? <PlayingBars playing={playing} /> : number}
          </span>
          <button
            type="button"
            aria-label={`Play ${track.title}`}
            tabIndex={-1}
            onClick={() => onPlay(index)}
            className="invisible absolute inset-0 flex items-center justify-center text-fg group-hover:visible"
          >
            <Play className="size-4 fill-current" />
          </button>
        </div>

        <div className="flex min-w-0 items-center gap-3">
          {variant !== 'album' && (
            <Artwork hash={track.artworkHash} className="size-10 shrink-0 rounded-md" />
          )}
          <div className="flex min-w-0 flex-col">
            <span className={cn('truncate text-sm', current ? 'text-love-text' : 'text-fg')}>
              {track.title}
              {!track.available && <span className="ml-2 text-xs text-fg-subtle">· missing</span>}
            </span>
            {showArtist && (
              <span className="truncate text-xs text-fg-muted">
                {track.artistId !== null ? (
                  <Link
                    href={`/artist?id=${track.artistId}`}
                    tabIndex={-1}
                    onClick={(event) => event.stopPropagation()}
                    className="hover:text-fg hover:underline"
                  >
                    {track.artistName}
                  </Link>
                ) : (
                  'Unknown artist'
                )}
              </span>
            )}
          </div>
        </div>

        {variant === 'library' && (
          <span className="truncate text-sm text-fg-muted max-lg:hidden">
            {track.albumId !== null ? (
              <Link
                href={`/album?id=${track.albumId}`}
                tabIndex={-1}
                className="hover:text-fg hover:underline"
              >
                {track.albumTitle}
              </Link>
            ) : (
              '—'
            )}
          </span>
        )}
        {variant === 'library' && (
          <span className="truncate text-xs text-fg-subtle max-lg:hidden">
            {dateFormat.format(track.dateAdded)}
          </span>
        )}

        <button
          type="button"
          aria-label={track.favorite ? `Remove ${track.title} from liked songs` : `Like ${track.title}`}
          aria-pressed={track.favorite}
          onClick={() => setFavorite(track.id, !track.favorite)}
          className={cn(
            'flex size-8 items-center justify-center rounded-full transition-opacity hover:bg-surface-3',
            track.favorite ? 'text-love' : 'text-fg-subtle opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
          )}
        >
          <Heart className={cn('size-4', track.favorite && 'fill-current')} />
        </button>

        <span className="text-right text-sm text-fg-subtle tabular-nums">
          {formatTime(track.durationMs / 1000)}
        </span>

        <button
          type="button"
          aria-label={`More options for ${track.title}`}
          onClick={openMenuFrom}
          className="flex size-8 items-center justify-center rounded-full text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface-3 hover:text-fg focus-visible:opacity-100"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </div>
    </TrackMenu>
  );
});

