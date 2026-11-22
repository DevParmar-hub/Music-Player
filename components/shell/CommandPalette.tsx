'use client';

import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import {
  Disc3,
  FolderCog,
  Heart,
  House,
  ListMusic,
  MicVocal,
  Monitor,
  Moon,
  Music2,
  Pause,
  RefreshCw,
  Search,
  Settings,
  Shuffle,
  SkipForward,
  Sun,
  type LucideIcon,
} from 'lucide-react';

import { Artwork } from '@/components/player/Artwork';
import { albumTracks, normalize, searchLibrary } from '@/lib/library/select';
import { usePlayer } from '@/lib/player/store';
import { useLibrary } from '@/lib/stores/library';
import { useScan } from '@/lib/stores/scan';
import { useSettings } from '@/lib/stores/settings';
import { useUi } from '@/lib/stores/ui';
import type { Track } from '@/lib/tauri/types';

interface Action {
  id: string;
  label: string;
  icon: LucideIcon;
  group: 'Go to' | 'Actions';
  run: () => void;
}

const GROUP = '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-fg-subtle [&_[cmdk-group-heading]]:uppercase';
const ITEM = 'flex h-11 cursor-default items-center gap-3 rounded-xl px-3 text-sm text-fg select-none data-[selected=true]:bg-surface-2';

/** Ctrl+K: search the library and run any command from the keyboard. */
export function CommandPalette() {
  const open = useUi((state) => state.paletteOpen);
  const setOpen = useUi((state) => state.setPaletteOpen);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(!useUi.getState().paletteOpen);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setOpen]);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Search and commands"
      shouldFilter={false}
      loop
      overlayClassName="fixed inset-0 z-50 bg-ink-950/45 backdrop-blur-sm animate-[menu-in_140ms_ease-out]"
      contentClassName="fixed top-[14vh] left-1/2 z-50 w-[min(640px,calc(100vw-32px))] -translate-x-1/2 animate-[menu-in_160ms_ease-out] overflow-hidden rounded-3xl border border-border bg-surface/95 shadow-float backdrop-blur-2xl"
    >
      {/* Remounted per opening, so each search starts blank. */}
      {open && <PaletteBody close={() => setOpen(false)} />}
    </Command.Dialog>
  );
}

function PaletteBody({ close }: { close: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const tracks = useLibrary((state) => state.tracks);
  const albums = useLibrary((state) => state.albums);
  const artists = useLibrary((state) => state.artists);
  const hasTrack = usePlayer((state) => state.queue[state.index] !== undefined);
  const playing = usePlayer((state) => state.playing);

  const results = useMemo(
    () => searchLibrary(deferredQuery, { tracks, albums, artists }),
    [deferredQuery, tracks, albums, artists],
  );

  const run = (task: () => void) => {
    close();
    task();
  };

  const actions: Action[] = useMemo(() => {
    const go = (path: string) => () => router.push(path);
    const theme = useSettings.getState().update;
    const list: Action[] = [
      { id: 'home', label: 'Home', icon: House, group: 'Go to', run: go('/') },
      { id: 'songs', label: 'Songs', icon: Music2, group: 'Go to', run: go('/songs') },
      { id: 'liked', label: 'Liked songs', icon: Heart, group: 'Go to', run: go('/songs?liked=1') },
      { id: 'albums', label: 'Albums', icon: Disc3, group: 'Go to', run: go('/albums') },
      { id: 'artists', label: 'Artists', icon: MicVocal, group: 'Go to', run: go('/artists') },
      { id: 'playlists', label: 'Playlists', icon: ListMusic, group: 'Go to', run: go('/playlists') },
      { id: 'manager', label: 'Library manager', icon: FolderCog, group: 'Go to', run: go('/manager') },
      { id: 'settings', label: 'Settings', icon: Settings, group: 'Go to', run: go('/settings') },
      {
        id: 'shuffle-all',
        label: 'Shuffle all songs',
        icon: Shuffle,
        group: 'Actions',
        run: () => usePlayer.getState().playTracks(useLibrary.getState().tracks, { shuffle: true, source: 'Your library' }),
      },
      { id: 'queue', label: 'Show queue', icon: ListMusic, group: 'Actions', run: () => useUi.getState().setQueueOpen(true) },
      { id: 'theme-dark', label: 'Switch to dark theme', icon: Moon, group: 'Actions', run: () => theme('theme', 'dark') },
      { id: 'theme-light', label: 'Switch to light theme', icon: Sun, group: 'Actions', run: () => theme('theme', 'light') },
      { id: 'theme-system', label: 'Match system theme', icon: Monitor, group: 'Actions', run: () => theme('theme', 'system') },
      { id: 'rescan', label: 'Rescan library', icon: RefreshCw, group: 'Actions', run: () => useScan.getState().rescan() },
    ];
    if (hasTrack) {
      list.splice(8, 0,
        { id: 'toggle', label: playing ? 'Pause' : 'Play', icon: playing ? Pause : Music2, group: 'Actions', run: () => usePlayer.getState().togglePlay() },
        { id: 'next', label: 'Next song', icon: SkipForward, group: 'Actions', run: () => usePlayer.getState().next() },
      );
    }
    return list;
  }, [router, hasTrack, playing]);

  const terms = normalize(deferredQuery).split(/\s+/).filter(Boolean);
  const matchingActions = actions.filter((action) =>
    terms.every((term) => normalize(action.label).includes(term)),
  );

  const playSong = (track: Track) => {
    // Play it within its album, so listening carries on naturally.
    const context = track.albumId !== null ? albumTracks(tracks, track.albumId) : [track];
    usePlayer.getState().playTracks(context, {
      startIndex: Math.max(0, context.findIndex((item) => item.id === track.id)),
      source: track.albumTitle ? `Album · ${track.albumTitle}` : 'Search',
    });
  };

  const hasResults =
    results.tracks.length + results.albums.length + results.artists.length + matchingActions.length > 0;

  return (
    <>
      <div className="flex items-center gap-3 border-b border-border px-5">
        <Search className="size-5 shrink-0 text-fg-subtle" />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Search songs, albums, artists, or type a command"
          className="h-14 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-subtle"
        />
        <kbd className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-fg-subtle">Esc</kbd>
      </div>

      <Command.List className="max-h-[min(60vh,520px)] overflow-y-auto p-2">
        {!hasResults && (
          <div className="px-3 py-10 text-center text-sm text-fg-muted">
            Nothing found for “{query}”.
          </div>
        )}

        {results.tracks.length > 0 && (
          <Command.Group heading="Songs" className={GROUP}>
            {results.tracks.map((track) => (
              <Command.Item key={`t${track.id}`} value={`t${track.id}`} onSelect={() => run(() => playSong(track))} className={ITEM}>
                <Artwork hash={track.artworkHash} className="size-8 shrink-0 rounded-md" />
                <ResultText title={track.title} detail={[track.artistName, track.albumTitle].filter(Boolean).join(' · ')} />
                <Hint>Play</Hint>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {results.albums.length > 0 && (
          <Command.Group heading="Albums" className={GROUP}>
            {results.albums.map((album) => (
              <Command.Item key={`a${album.id}`} value={`a${album.id}`} onSelect={() => run(() => router.push(`/album?id=${album.id}`))} className={ITEM}>
                <Artwork hash={album.artworkHash} className="size-8 shrink-0 rounded-md" />
                <ResultText title={album.title} detail={album.artistName ?? 'Various artists'} />
                <Hint>Open</Hint>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {results.artists.length > 0 && (
          <Command.Group heading="Artists" className={GROUP}>
            {results.artists.map((artist) => (
              <Command.Item key={`r${artist.id}`} value={`r${artist.id}`} onSelect={() => run(() => router.push(`/artist?id=${artist.id}`))} className={ITEM}>
                <Artwork hash={artist.artworkHash} className="size-8 shrink-0 rounded-full" />
                <ResultText title={artist.name} detail={`${artist.trackCount.toLocaleString()} songs`} />
                <Hint>Open</Hint>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {(['Go to', 'Actions'] as const).map((group) => {
          const items = matchingActions.filter((action) => action.group === group);
          if (items.length === 0) return null;
          return (
            <Command.Group key={group} heading={group} className={GROUP}>
              {items.map(({ id, label, icon: Icon, run: task }) => (
                <Command.Item key={id} value={id} onSelect={() => run(task)} className={ITEM}>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-fg-muted">
                    <Icon className="size-4" />
                  </span>
                  <span className="flex-1 truncate">{label}</span>
                </Command.Item>
              ))}
            </Command.Group>
          );
        })}
      </Command.List>
    </>
  );
}

function ResultText({ title, detail }: { title: string; detail: string }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate">{title}</span>
      {detail && <span className="truncate text-xs text-fg-muted">{detail}</span>}
    </span>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <span className="text-xs text-fg-subtle opacity-0 [[data-selected=true]_&]:opacity-100">{children}</span>;
}
