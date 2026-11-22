'use client';

// Stage 0 check page: exercises folders, scanning, artwork,
// playback and playlists end to end. Kept as a developer lab until
// the real views cover all of it.

import { useCallback, useEffect, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';

import * as api from '@/lib/tauri/api';
import { usePlayer } from '@/lib/player/store';
import { artworkUrl, loadArtworkDirectory } from '@/lib/tauri/assets';
import type {
  LibraryRoot,
  LibraryStats,
  Playlist,
  ScanProgress,
  Track,
} from '@/lib/tauri/types';

const VISIBLE_TRACKS = 50;

export default function Home() {
  const [roots, setRoots] = useState<LibraryRoot[]>([]);
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [artworkDirectory, setArtworkDirectory] = useState('');
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [scanning, setScanning] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [error, setError] = useState('');

  const report = (caught: unknown) => setError(String(caught));

  const refresh = useCallback(async () => {
    try {
      const [nextRoots, nextStats, nextTracks, nextPlaylists] = await Promise.all([
        api.getLibraryRoots(),
        api.getLibraryStats(),
        api.getTracks(),
        api.getPlaylists(),
      ]);
      setRoots(nextRoots);
      setStats(nextStats);
      setTracks(nextTracks);
      setPlaylists(nextPlaylists);
    } catch (caught) {
      report(caught);
    }
  }, []);

  useEffect(() => {
    // Loading data on mount is this effect's purpose.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    loadArtworkDirectory().then(setArtworkDirectory).catch(report);
    api
      .getScanStatus()
      .then((status) => {
        setScanning(status.running);
        setProgress(status.progress);
      })
      .catch(report);

    const unlisteners = [
      api.onScanProgress((next) => {
        setProgress(next);
        setScanning(next.phase === 'discovering' || next.phase === 'indexing');
      }),
      api.onLibraryChanged(refresh),
    ];

    return () => {
      unlisteners.forEach((unlisten) => unlisten.then((stop) => stop()));
    };
  }, [refresh]);

  async function addFolder() {
    setError('');
    try {
      const path = await open({ directory: true, title: 'Choose a music folder' });
      if (typeof path !== 'string') return;
      await api.addLibraryRoot(path);
      await refresh();
      await api.startLibraryScan();
      setScanning(true);
    } catch (caught) {
      report(caught);
    }
  }

  async function removeFolder(rootId: number) {
    setError('');
    try {
      await api.removeLibraryRoot(rootId);
      await refresh();
    } catch (caught) {
      report(caught);
    }
  }

  async function scan() {
    setError('');
    try {
      await api.startLibraryScan();
      setScanning(true);
    } catch (caught) {
      report(caught);
    }
  }

  // Plays through the real engine, with the visible list as the queue.
  function play(index: number) {
    usePlayer.getState().playTracks(tracks.slice(0, VISIBLE_TRACKS), {
      startIndex: index,
      source: 'Backend check',
    });
  }

  async function toggleFavorite(track: Track) {
    try {
      await api.setTrackFavorite(track.id, !track.favorite);
      setTracks((current) =>
        current.map((item) =>
          item.id === track.id ? { ...item, favorite: !item.favorite } : item,
        ),
      );
    } catch (caught) {
      report(caught);
    }
  }

  async function createPlaylist() {
    setError('');
    try {
      await api.createPlaylist(playlistName);
      setPlaylistName('');
      await refresh();
    } catch (caught) {
      report(caught);
    }
  }

  async function addToPlaylist(playlistId: number, trackId: number) {
    try {
      await api.addTracksToPlaylist(playlistId, [trackId]);
      await refresh();
    } catch (caught) {
      report(caught);
    }
  }

  const percent =
    progress && progress.total > 0
      ? Math.round((progress.processed / progress.total) * 100)
      : 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-8 font-sans">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Stage 0 check</h1>
        {stats && (
          <p className="text-sm opacity-70">
            {stats.trackCount} tracks · {stats.albumCount} albums · {stats.artistCount}{' '}
            artists · {stats.unavailableCount} missing · schema v{stats.schemaVersion}
          </p>
        )}
      </header>

      {error && (
        <p className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm">{error}</p>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-medium">Library folders</h2>
          <button className="rounded border px-3 py-1 text-sm" onClick={addFolder}>
            Add folder
          </button>
          <button
            className="rounded border px-3 py-1 text-sm disabled:opacity-40"
            onClick={scan}
            disabled={scanning || roots.length === 0}
          >
            Rescan
          </button>
          {scanning && (
            <button className="rounded border px-3 py-1 text-sm" onClick={api.cancelLibraryScan}>
              Cancel
            </button>
          )}
        </div>
        <ul className="text-sm">
          {roots.map((root) => (
            <li key={root.id} className="flex items-center gap-3">
              <span className="font-mono">{root.path}</span>
              <span className="opacity-60">{root.trackCount} tracks</span>
              <button className="underline opacity-70" onClick={() => removeFolder(root.id)}>
                remove
              </button>
            </li>
          ))}
        </ul>

        {progress && (
          <div className="flex flex-col gap-1 text-sm">
            <div className="h-2 w-full overflow-hidden rounded bg-neutral-500/20">
              <div className="h-full bg-teal-400 transition-all" style={{ width: `${percent}%` }} />
            </div>
            <p>
              {progress.phase} · folder {progress.rootIndex}/{progress.rootCount} ·{' '}
              {progress.processed}/{progress.total} files · {progress.inserted} new ·{' '}
              {progress.updated} updated · {progress.failed} failed · {progress.unavailable}{' '}
              now missing
            </p>
            {progress.currentFile && (
              <p className="truncate font-mono text-xs opacity-60">{progress.currentFile}</p>
            )}
            {progress.message && <p className="text-red-400">{progress.message}</p>}
            {progress.errors.length > 0 && (
              <details>
                <summary>{progress.errors.length} problems</summary>
                <ul className="font-mono text-xs opacity-70">
                  {progress.errors.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-medium">Playlists</h2>
          <input
            className="rounded border bg-transparent px-2 py-1 text-sm"
            placeholder="New playlist name"
            value={playlistName}
            onChange={(event) => setPlaylistName(event.target.value)}
          />
          <button className="rounded border px-3 py-1 text-sm" onClick={createPlaylist}>
            Create
          </button>
        </div>
        <ul className="text-sm">
          {playlists.map((playlist) => (
            <li key={playlist.id} className="flex gap-3">
              <span>{playlist.name}</span>
              <span className="opacity-60">{playlist.trackCount} tracks</span>
              <button
                className="underline opacity-70"
                onClick={() => api.deletePlaylist(playlist.id).then(refresh, report)}
              >
                delete
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">
          Tracks {tracks.length > VISIBLE_TRACKS && `(first ${VISIBLE_TRACKS})`}
        </h2>
        <ul className="flex flex-col gap-1">
          {tracks.slice(0, VISIBLE_TRACKS).map((track, index) => (
            <li key={track.id} className="flex items-center gap-3 text-sm">
              {track.artworkHash && artworkDirectory ? (
                // Local asset-protocol image; next/image cannot optimize it.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={artworkUrl(artworkDirectory, track.artworkHash)}
                  alt=""
                  className="h-10 w-10 rounded object-cover"
                />
              ) : (
                <div className="h-10 w-10 rounded bg-neutral-500/20" />
              )}
              <button className="underline" onClick={() => play(index)} disabled={!track.available}>
                play
              </button>
              <button className="underline opacity-70" onClick={() => usePlayer.getState().playNext([track])}>
                next
              </button>
              <button className="underline opacity-70" onClick={() => usePlayer.getState().addToQueue([track])}>
                + queue
              </button>
              <button onClick={() => toggleFavorite(track)} aria-label="Favorite">
                {track.favorite ? '♥' : '♡'}
              </button>
              <span className={track.available ? '' : 'line-through opacity-50'}>
                {track.title}
              </span>
              <span className="opacity-60">
                {track.artistName ?? 'Unknown artist'} · {track.albumTitle ?? 'Unknown album'}
                {track.year && ` · ${track.year}`}
              </span>
              {playlists[0] && (
                <button
                  className="ml-auto underline opacity-70"
                  onClick={() => addToPlaylist(playlists[0].id, track.id)}
                >
                  + {playlists[0].name}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
