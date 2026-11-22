// Remember the queue, position and modes across restarts. Stored as
// one JSON setting; only track IDs are saved, so a rescan that changes
// metadata never leaves stale details behind.

import * as api from '@/lib/tauri/api';
import type { JsonValue } from '@/lib/tauri/types';
import { getEngine } from './engine';
import { usePlayer, type QueueItem, type RepeatMode } from './store';

const SETTING_KEY = 'playbackSession';
const SAVE_DEBOUNCE_MS = 1000;
const POSITION_SAVE_INTERVAL_MS = 5000;

interface SavedSession {
  trackIds: number[];
  unshuffledIds: number[] | null;
  index: number;
  position: number;
  source: string | null;
  shuffle: boolean;
  repeat: RepeatMode;
  volume: number;
  muted: boolean;
}

function snapshot(): SavedSession {
  const state = usePlayer.getState();
  return {
    trackIds: state.queue.map((item) => item.track.id),
    unshuffledIds: state.unshuffled?.map((item) => item.track.id) ?? null,
    index: state.index,
    position: Math.floor(getEngine().currentTime),
    source: state.source,
    shuffle: state.shuffle,
    repeat: state.repeat,
    volume: state.volume,
    muted: state.muted,
  };
}

function save() {
  api.setSetting(SETTING_KEY, snapshot() as unknown as JsonValue).catch((error) => {
    console.warn('Could not save playback session:', error);
  });
}

function parse(value: JsonValue | undefined): SavedSession | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const session = value as unknown as SavedSession;
  if (!Array.isArray(session.trackIds) || typeof session.index !== 'number') return null;
  return session;
}

/** Restore the last session (paused) and keep saving changes. */
export async function startSession(): Promise<() => void> {
  try {
    await restore();
  } catch (error) {
    console.warn('Could not restore playback session:', error);
  }

  let timer: number | undefined;
  const scheduleSave = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(save, SAVE_DEBOUNCE_MS);
  };

  const unsubscribe = usePlayer.subscribe((state, previous) => {
    if (
      state.queue !== previous.queue ||
      state.index !== previous.index ||
      state.shuffle !== previous.shuffle ||
      state.repeat !== previous.repeat ||
      state.volume !== previous.volume ||
      state.muted !== previous.muted ||
      state.playing !== previous.playing
    ) {
      scheduleSave();
    }
  });

  const interval = window.setInterval(() => {
    if (usePlayer.getState().playing) save();
  }, POSITION_SAVE_INTERVAL_MS);

  window.addEventListener('beforeunload', save);

  return () => {
    unsubscribe();
    window.clearTimeout(timer);
    window.clearInterval(interval);
    window.removeEventListener('beforeunload', save);
  };
}

async function restore() {
  const settings = await api.getSettings();
  const session = parse(settings[SETTING_KEY]);
  if (!session || session.trackIds.length === 0) return;

  const library = new Map((await api.getTracks()).map((track) => [track.id, track]));

  const queue: QueueItem[] = [];
  let nextKey = -1;
  for (const id of session.trackIds) {
    const track = library.get(id);
    // Negative keys never collide with keys the store hands out.
    if (track) queue.push({ key: nextKey--, track });
  }
  if (queue.length === 0) return;

  const currentId = session.trackIds[session.index];
  const index = Math.max(0, queue.findIndex((item) => item.track.id === currentId));
  const resumedSameSong = queue[index]?.track.id === currentId;

  usePlayer.getState().hydrateQueue(
    {
      queue,
      unshuffled: session.unshuffledIds ? matchItems(session.unshuffledIds, queue) : null,
      index,
      source: session.source ?? null,
      shuffle: Boolean(session.shuffle),
      repeat: (['off', 'all', 'one'] as const).includes(session.repeat) ? session.repeat : 'off',
      volume: clampVolume(session.volume),
      muted: Boolean(session.muted),
    },
    resumedSameSong ? session.position : 0,
  );
}

/** Rebuild the pre-shuffle order from the same queue items. */
function matchItems(ids: number[], queue: QueueItem[]): QueueItem[] {
  const pool = new Map<number, QueueItem[]>();
  for (const item of queue) pool.set(item.track.id, [...(pool.get(item.track.id) ?? []), item]);
  return ids.flatMap((id) => {
    const item = pool.get(id)?.shift();
    return item ? [item] : [];
  });
}

function clampVolume(volume: unknown): number {
  return typeof volume === 'number' && volume >= 0 && volume <= 1 ? volume : 0.8;
}

