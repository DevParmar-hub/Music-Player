import { usePlayer } from '@/lib/player/store';
import { useLibrary } from '@/lib/stores/library';
import { toast } from '@/lib/stores/toast';
import * as api from '@/lib/tauri/api';

/**
 * Like or unlike a song everywhere it is shown (library views and the
 * queue), rolling back if the database write fails.
 */
export async function setFavorite(trackId: number, favorite: boolean) {
  const apply = (value: boolean) => {
    useLibrary.getState().patchTrack(trackId, { favorite: value });
    usePlayer.getState().patchTrack(trackId, { favorite: value });
  };

  apply(favorite);
  try {
    await api.setTrackFavorite(trackId, favorite);
  } catch (error) {
    apply(!favorite);
    toast(`Couldn't update your liked songs: ${String(error)}`, { tone: 'error' });
  }
}
