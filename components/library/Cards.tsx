'use client';

import Link from 'next/link';
import type { MouseEvent, ReactNode } from 'react';
import { Play } from 'lucide-react';

import { Artwork } from '@/components/player/Artwork';
import { Tilt } from '@/components/ui/Tilt';
import { cn } from '@/lib/cn';
import { pluralize } from '@/lib/library/select';
import { usePlayer } from '@/lib/player/store';
import type { Album, Artist, Track } from '@/lib/tauri/types';
import { TrackMenu } from './TrackMenu';

// Off-screen cards skip layout and paint entirely.
const OFFSCREEN_CHEAP = '[content-visibility:auto] [contain-intrinsic-size:auto_280px]';

function PlayOverlay({ label, onPlay, round = false }: { label: string; onPlay: () => void; round?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event: MouseEvent) => {
        event.stopPropagation();
        onPlay();
      }}
      className={cn(
        'absolute flex size-11 translate-y-2 items-center justify-center rounded-full bg-accent text-accent-fg opacity-0 shadow-float transition-all duration-200',
        'group-hover:translate-y-0 group-hover:opacity-100 hover:scale-105 hover:bg-accent-hover focus-visible:translate-y-0 focus-visible:opacity-100',
        round ? 'right-1 bottom-1' : 'right-3 bottom-3',
      )}
    >
      <Play className="ml-0.5 size-5 fill-current" />
    </button>
  );
}

export function AlbumCard({ album, tracks }: { album: Album; tracks: Track[] }) {
  const source = `Album · ${album.title}`;
  const play = () => usePlayer.getState().playTracks(tracks, { source });

  return (
    <TrackMenu tracks={tracks} source={source}>
      <div className={cn('group flex flex-col gap-3', OFFSCREEN_CHEAP)}>
        <Tilt className="aspect-square overflow-hidden rounded-2xl shadow-float">
          <Link
            href={`/album?id=${album.id}`}
            aria-label={`${album.title}${album.artistName ? ` by ${album.artistName}` : ''}`}
            className="block size-full"
          >
            <Artwork
              hash={album.artworkHash}
              className="size-full transition-transform duration-500 group-hover:scale-[1.03]"
            />
          </Link>
          <PlayOverlay label={`Play ${album.title}`} onPlay={play} />
        </Tilt>
        <div className="flex min-w-0 flex-col px-0.5">
          <Link href={`/album?id=${album.id}`} className="truncate text-sm font-medium text-fg hover:underline">
            {album.title}
          </Link>
          <span className="truncate text-xs text-fg-muted">
            {album.artistId !== null ? (
              <Link href={`/artist?id=${album.artistId}`} className="hover:text-fg hover:underline">
                {album.artistName}
              </Link>
            ) : (
              'Various artists'
            )}
            {album.year && ` · ${album.year}`}
          </span>
        </div>
      </div>
    </TrackMenu>
  );
}

export function ArtistCard({ artist, tracks }: { artist: Artist; tracks: Track[] }) {
  const source = `Artist · ${artist.name}`;
  const play = () => usePlayer.getState().playTracks(tracks, { source, shuffle: true });

  return (
    <TrackMenu tracks={tracks} source={source}>
      <div className={cn('group flex flex-col items-center gap-3 text-center', OFFSCREEN_CHEAP)}>
        <Tilt className="aspect-square w-full overflow-hidden rounded-full shadow-float">
          <Link href={`/artist?id=${artist.id}`} aria-label={artist.name} className="block size-full">
            <Artwork hash={artist.artworkHash} className="size-full" />
          </Link>
          <PlayOverlay label={`Shuffle ${artist.name}`} onPlay={play} round />
        </Tilt>
        <div className="flex min-w-0 flex-col">
          <Link href={`/artist?id=${artist.id}`} className="truncate text-sm font-medium text-fg hover:underline">
            {artist.name}
          </Link>
          <span className="truncate text-xs text-fg-muted">
            {pluralize(artist.albumCount, 'album')} · {pluralize(artist.trackCount, 'song')}
          </span>
        </div>
      </div>
    </TrackMenu>
  );
}

/** Responsive grid for cards. */
export function CardGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-x-6 gap-y-8">{children}</div>
  );
}
