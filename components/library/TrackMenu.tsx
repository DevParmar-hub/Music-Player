'use client';

import type { MouseEvent, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ContextMenu } from 'radix-ui';
import {
  Disc3,
  Heart,
  ListEnd,
  ListMusic,
  ListPlus,
  ListStart,
  MicVocal,
  Play,
  Plus,
} from 'lucide-react';

import { setFavorite } from '@/lib/actions/favorites';
import { addToPlaylist } from '@/lib/actions/playlists';
import { usePlayer } from '@/lib/player/store';
import { useLibrary } from '@/lib/stores/library';
import { useUi } from '@/lib/stores/ui';
import type { Track } from '@/lib/tauri/types';

const CONTENT =
  'z-50 min-w-[220px] origin-[var(--radix-context-menu-content-transform-origin)] animate-[menu-in_120ms_ease-out] rounded-xl border border-border bg-surface/95 p-1 text-sm text-fg shadow-float backdrop-blur-xl';
const ITEM =
  'flex h-8 cursor-default items-center gap-2.5 rounded-lg px-2.5 outline-none select-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface-2';
const ICON = 'size-4 text-fg-muted';
const SEPARATOR = 'my-1 h-px bg-border';

interface TrackMenuProps {
  /** The songs the menu acts on: one song, an album, an artist... */
  tracks: Track[];
  /** Queue label for "Play", e.g. "Album · Blue". */
  source?: string;
  children: ReactNode;
}

/**
 * Right-click menu for songs and collections. Wraps the element it
 * belongs to; MoreButton opens it from a "…" button too.
 */
export function TrackMenu({ tracks, source, children }: TrackMenuProps) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className={CONTENT} collisionPadding={8}>
          <TrackMenuItems tracks={tracks} source={source} />
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

function TrackMenuItems({ tracks, source }: { tracks: Track[]; source?: string }) {
  const router = useRouter();
  const playlists = useLibrary((state) => state.playlists);
  const openNewPlaylist = useUi((state) => state.openNewPlaylist);
  const player = usePlayer.getState;

  const single = tracks.length === 1 ? tracks[0] : null;
  const playable = tracks.filter((track) => track.available);

  return (
    <>
      <ContextMenu.Item
        className={ITEM}
        disabled={playable.length === 0}
        onSelect={() => player().playTracks(tracks, { source })}
      >
        <Play className={ICON} /> Play
      </ContextMenu.Item>
      <ContextMenu.Item className={ITEM} disabled={playable.length === 0} onSelect={() => player().playNext(playable)}>
        <ListStart className={ICON} /> Play next
      </ContextMenu.Item>
      <ContextMenu.Item className={ITEM} disabled={playable.length === 0} onSelect={() => player().addToQueue(playable)}>
        <ListEnd className={ICON} /> Add to queue
      </ContextMenu.Item>

      <ContextMenu.Separator className={SEPARATOR} />

      <ContextMenu.Sub>
        <ContextMenu.SubTrigger className={`${ITEM} data-[state=open]:bg-surface-2`}>
          <ListPlus className={ICON} /> Add to playlist
        </ContextMenu.SubTrigger>
        <ContextMenu.Portal>
          <ContextMenu.SubContent className={`${CONTENT} max-h-80 overflow-y-auto`} sideOffset={4} collisionPadding={8}>
            <ContextMenu.Item className={ITEM} onSelect={() => openNewPlaylist(tracks)}>
              <Plus className={ICON} /> New playlist…
            </ContextMenu.Item>
            {playlists.length > 0 && <ContextMenu.Separator className={SEPARATOR} />}
            {playlists.map((playlist) => (
              <ContextMenu.Item key={playlist.id} className={ITEM} onSelect={() => addToPlaylist(playlist, tracks)}>
                <ListMusic className={ICON} />
                <span className="truncate">{playlist.name}</span>
              </ContextMenu.Item>
            ))}
          </ContextMenu.SubContent>
        </ContextMenu.Portal>
      </ContextMenu.Sub>

      {single && (
        <>
          <ContextMenu.Separator className={SEPARATOR} />
          <ContextMenu.Item className={ITEM} onSelect={() => setFavorite(single.id, !single.favorite)}>
            <Heart className={single.favorite ? 'size-4 fill-love text-love' : ICON} />
            {single.favorite ? 'Remove from liked songs' : 'Like'}
          </ContextMenu.Item>
          {single.albumId !== null && (
            <ContextMenu.Item className={ITEM} onSelect={() => router.push(`/album?id=${single.albumId}`)}>
              <Disc3 className={ICON} /> Go to album
            </ContextMenu.Item>
          )}
          {single.artistId !== null && (
            <ContextMenu.Item className={ITEM} onSelect={() => router.push(`/artist?id=${single.artistId}`)}>
              <MicVocal className={ICON} /> Go to artist
            </ContextMenu.Item>
          )}
        </>
      )}
    </>
  );
}

/**
 * Open the surrounding TrackMenu from a button. Radix context menus
 * open on a contextmenu event, so the button fires one at itself.
 */
export function openMenuFrom(event: MouseEvent<HTMLElement>) {
  event.stopPropagation();
  const rect = event.currentTarget.getBoundingClientRect();
  event.currentTarget.dispatchEvent(
    new globalThis.MouseEvent('contextmenu', {
      bubbles: true,
      clientX: rect.left,
      clientY: rect.bottom + 4,
    }),
  );
}
