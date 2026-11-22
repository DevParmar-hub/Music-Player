'use client';

import { useState, type FormEvent } from 'react';
import { Dialog } from 'radix-ui';

import { Button } from '@/components/ui/Button';
import { createPlaylistWith } from '@/lib/actions/playlists';
import { pluralize } from '@/lib/library/select';
import { useUi } from '@/lib/stores/ui';
import type { Track } from '@/lib/tauri/types';

/** Name a new playlist; any songs it was opened with go straight in. */
export function NewPlaylistDialog() {
  const tracks = useUi((state) => state.newPlaylistTracks);
  const close = useUi((state) => state.closeNewPlaylist);

  return (
    <Dialog.Root open={tracks !== null} onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-[menu-in_160ms_ease-out] bg-ink-950/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 animate-[menu-in_180ms_ease-out] rounded-3xl border border-border bg-surface p-6 shadow-float">
          {/* Remounts per opening, so the form always starts empty. */}
          {tracks && <NewPlaylistForm tracks={tracks} onDone={close} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function NewPlaylistForm({ tracks, onDone }: { tracks: Track[]; onDone: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createPlaylistWith(name, tracks);
      onDone();
    } catch (caught) {
      setError(String(caught));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Dialog.Title className="font-display text-3xl text-fg">New playlist</Dialog.Title>
        <Dialog.Description className="text-sm text-fg-muted">
          {tracks.length > 0 ? `${pluralize(tracks.length, 'song')} will be added.` : 'Start an empty playlist.'}
        </Dialog.Description>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium tracking-wide text-fg-subtle uppercase">Name</span>
        <input
          autoFocus
          value={name}
          maxLength={100}
          onChange={(event) => setName(event.target.value)}
          placeholder="Late night drive"
          aria-invalid={error !== null}
          aria-describedby={error ? 'new-playlist-error' : undefined}
          className="h-11 rounded-xl border border-border bg-surface-2 px-3.5 text-fg outline-none placeholder:text-fg-subtle focus:border-accent"
        />
      </label>

      {error && (
        <p id="new-playlist-error" role="alert" className="text-sm text-love-text">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Dialog.Close asChild>
          <Button variant="ghost">Cancel</Button>
        </Dialog.Close>
        <Button type="submit" variant="primary" disabled={saving || name.trim() === ''}>
          {saving ? 'Creating…' : 'Create'}
        </Button>
      </div>
    </form>
  );
}
