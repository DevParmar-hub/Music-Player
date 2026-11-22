'use client';

import Link from 'next/link';
import { useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { ArrowRight, Heart, Play, Shuffle } from 'lucide-react';

import { AlbumCard } from '@/components/library/Cards';
import { ScanProgressCard } from '@/components/library/ScanProgressCard';
import { TrackList } from '@/components/library/TrackList';
import { TrackMenu } from '@/components/library/TrackMenu';
import { Welcome } from '@/components/library/Welcome';
import { Artwork } from '@/components/player/Artwork';
import { PlayingBars } from '@/components/player/PlayingBars';
import { Button } from '@/components/ui/Button';
import { Page, PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/cn';
import {
  albumAddedDates,
  describeDuration,
  groupByAlbum,
  pluralize,
  sortAlbums,
  totalDuration,
} from '@/lib/library/select';
import { usePlayer } from '@/lib/player/store';
import { useLibrary } from '@/lib/stores/library';
import { useScan } from '@/lib/stores/scan';
import type { Track } from '@/lib/tauri/types';

const RECENT_TRACKS = 8;
const RECENT_ALBUMS = 12;
const MOST_PLAYED = 5;

function greeting(hour: number): string {
  if (hour < 5) return 'Late night listening';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// The hour only matters on the client; the static export renders a
// neutral title that is replaced after hydration.
const subscribeNever = () => () => {};

export default function Home() {
  const status = useLibrary((state) => state.status);
  const hasTracks = useLibrary((state) => state.tracks.length > 0);

  if (status !== 'ready') return null;
  return hasTracks ? <LibraryHome /> : <Welcome />;
}

function LibraryHome() {
  const title = useSyncExternalStore(
    subscribeNever,
    () => greeting(new Date().getHours()),
    () => 'Welcome back',
  );
  const tracks = useLibrary((state) => state.tracks);
  const albums = useLibrary((state) => state.albums);
  const running = useScan((state) => state.running);

  const shelves = useMemo(() => {
    const addedDates = albumAddedDates(tracks);
    return {
      recentlyPlayed: tracks
        .filter((track) => track.lastPlayed !== null)
        .sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0))
        .slice(0, RECENT_TRACKS),
      recentAlbums: sortAlbums(albums, 'added', addedDates).slice(0, RECENT_ALBUMS),
      mostPlayed: tracks
        .filter((track) => track.playCount > 0)
        .sort((a, b) => b.playCount - a.playCount)
        .slice(0, MOST_PLAYED),
      liked: tracks.filter((track) => track.favorite),
      tracksByAlbum: groupByAlbum(tracks),
    };
  }, [tracks, albums]);

  const shuffleAll = () =>
    usePlayer.getState().playTracks(tracks, { shuffle: true, source: 'Your library' });

  return (
    <Page>
      <PageHeader
        eyebrow="Home"
        title={title}
        description={`${pluralize(tracks.length, 'song')} · ${pluralize(albums.length, 'album')} · ${describeDuration(totalDuration(tracks))}`}
        actions={
          <Button variant="primary" icon={<Shuffle className="size-4" />} onClick={shuffleAll}>
            Shuffle all
          </Button>
        }
      />

      {running && <ScanProgressCard />}

      {shelves.recentlyPlayed.length > 0 && (
        <Shelf title="Jump back in">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {shelves.recentlyPlayed.map((track, index) => (
              <QuickTile key={track.id} track={track} queue={shelves.recentlyPlayed} index={index} />
            ))}
          </div>
        </Shelf>
      )}

      {shelves.recentAlbums.length > 0 && (
        <Shelf title="Recently added" href="/albums">
          <div className="-mx-2 grid snap-x auto-cols-[176px] grid-flow-col gap-6 overflow-x-auto px-2 pt-2 pb-4">
            {shelves.recentAlbums.map((album) => (
              <div key={album.id} className="snap-start">
                <AlbumCard album={album} tracks={shelves.tracksByAlbum.get(album.id) ?? []} />
              </div>
            ))}
          </div>
        </Shelf>
      )}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <LikedSongsCard liked={shelves.liked} />
        {shelves.mostPlayed.length > 0 && (
          <Shelf title="Most played">
            <TrackList tracks={shelves.mostPlayed} variant="compact" source="Most played" />
          </Shelf>
        )}
      </div>
    </Page>
  );
}

function Shelf({ title, href, children }: { title: string; href?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-3xl text-fg">{title}</h2>
        {href && (
          <Link href={href} className="flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
            See all <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** Compact "jump back in" tile; plays the shelf from this song. */
function QuickTile({ track, queue, index }: { track: Track; queue: Track[]; index: number }) {
  const current = usePlayer((state) => state.queue[state.index]?.track.id === track.id);
  const playing = usePlayer((state) => state.playing);
  const play = () => usePlayer.getState().playTracks(queue, { startIndex: index, source: 'Jump back in' });

  return (
    <TrackMenu tracks={[track]} source="Jump back in">
      <button
        type="button"
        onClick={play}
        className="group flex items-center gap-3 overflow-hidden rounded-xl bg-surface-2/60 pr-3 text-left transition-colors hover:bg-surface-3"
      >
        <Artwork hash={track.artworkHash} className="size-14 shrink-0" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cn('truncate text-sm font-medium', current ? 'text-love-text' : 'text-fg')}>
            {track.title}
          </span>
          <span className="truncate text-xs text-fg-muted">{track.artistName ?? 'Unknown artist'}</span>
        </span>
        {current ? (
          <PlayingBars playing={playing} />
        ) : (
          <span className="flex size-8 items-center justify-center rounded-full bg-accent text-accent-fg opacity-0 shadow-float transition-opacity group-hover:opacity-100">
            <Play className="ml-0.5 size-3.5 fill-current" />
          </span>
        )}
      </button>
    </TrackMenu>
  );
}

function LikedSongsCard({ liked }: { liked: Track[] }) {
  const play = () => usePlayer.getState().playTracks(liked, { source: 'Liked songs' });

  return (
    <section className="relative isolate flex min-h-56 flex-col justify-end overflow-hidden rounded-3xl border border-border p-6">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-br from-pink-500/25 via-pink-500/5 to-teal-500/20"
      />
      <Heart className="absolute top-6 right-6 size-10 fill-love text-love opacity-80" />
      <h2 className="font-display text-4xl text-fg">Liked songs</h2>
      <p className="mt-1 text-sm text-fg-muted">
        {liked.length > 0 ? pluralize(liked.length, 'song') : 'Tap the heart on any song to keep it here.'}
      </p>
      <div className="mt-5 flex gap-2">
        {liked.length > 0 && (
          <Button variant="primary" size="sm" icon={<Play className="size-3.5 fill-current" />} onClick={play}>
            Play
          </Button>
        )}
        <Link
          href="/songs?liked=1"
          className="flex h-8 items-center rounded-full border border-border bg-surface-2/60 px-3 text-sm text-fg hover:bg-surface-3"
        >
          Open
        </Link>
      </div>
    </section>
  );
}
