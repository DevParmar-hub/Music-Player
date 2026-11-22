import { pluralize } from '@/lib/library/select';
import { useLibrary } from '@/lib/stores/library';
import { toast } from '@/lib/stores/toast';
import * as api from '@/lib/tauri/api';
import type { Playlist, Track } from '@/lib/tauri/types';

function describe(tracks: Track[]): string {
  return tracks.length === 1 ? `"${tracks[0].title}"` : pluralize(tracks.length, 'song');
}

export async function addToPlaylist(playlist: Playlist, tracks: Track[]) {
  try {
    await api.addTracksToPlaylist(playlist.id, tracks.map((track) => track.id));
    toast(`Added ${describe(tracks)} to "${playlist.name}"`);
    await useLibrary.getState().loadPlaylists();
  } catch (error) {
    toast(`Couldn't add to "${playlist.name}": ${String(error)}`, { tone: 'error' });
  }
}

/** Create a playlist, optionally starting it with songs. Throws on failure. */
export async function createPlaylistWith(name: string, tracks: Track[]): Promise<Playlist> {
  const playlist = await api.createPlaylist(name);
  if (tracks.length > 0) {
    await api.addTracksToPlaylist(playlist.id, tracks.map((track) => track.id));
  }
  toast(
    tracks.length > 0
      ? `Created "${playlist.name}" with ${describe(tracks)}`
      : `Created "${playlist.name}"`,
  );
  await useLibrary.getState().loadPlaylists();
  return playlist;
}
