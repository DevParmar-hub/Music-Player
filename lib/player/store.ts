// Playback state and the queue. The engine makes the sound; this store
// decides what plays next.

import { create } from 'zustand';

import { useLibrary } from '@/lib/stores/library';
import { useSettings } from '@/lib/stores/settings';
import { toast } from '@/lib/stores/toast';
import * as api from '@/lib/tauri/api';
import { audioUrl } from '@/lib/tauri/assets';
import type { Track } from '@/lib/tauri/types';
import { getEngine, type EngineHandlers } from './engine';
import { notifyPosition, startPositionUpdates, stopPositionUpdates } from './position';

export type RepeatMode = 'off' | 'all' | 'one';

/** One slot in the queue; the same track may occupy several. */
export interface QueueItem {
  key: number;
  track: Track;
}

/** "Previous" restarts the song instead once this far in. */
const RESTART_THRESHOLD_SECONDS = 3;
/** A play counts after this much listening, or half the song if shorter. */
const PLAY_COUNT_SECONDS = 30;
/** Stop trying after this many songs in a row fail to play. */
const MAX_CONSECUTIVE_ERRORS = 3;

interface PlayerStore {
  queue: QueueItem[];
  /** Queue order from before shuffle was turned on. */
  unshuffled: QueueItem[] | null;
  index: number;
  /** Where the queue came from, e.g. "Album · Kind of Blue". */
  source: string | null;
  playing: boolean;
  loading: boolean;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;

  playTracks: (tracks: Track[], options?: { startIndex?: number; source?: string; shuffle?: boolean }) => void;
  playNext: (tracks: Track[]) => void;
  addToQueue: (tracks: Track[]) => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  seekBy: (deltaSeconds: number) => void;
  jumpTo: (index: number) => void;
  removeAt: (index: number) => void;
  moveItem: (from: number, to: number) => void;
  /** Replace the songs right after the current one with this order. */
  reorderUpcoming: (items: QueueItem[]) => void;
  clearUpcoming: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  /** Update a track's details in every queue slot that holds it. */
  patchTrack: (trackId: number, patch: Partial<Track>) => void;
  /** Internal: used by session restore. */
  hydrateQueue: (state: Pick<PlayerStore, 'queue' | 'unshuffled' | 'index' | 'source' | 'shuffle' | 'repeat' | 'volume' | 'muted'>, startAt: number) => void;
}

// ============================================================
// Helpers
// ============================================================

let nextKey = 1;
const toItems = (tracks: Track[]): QueueItem[] => tracks.map((track) => ({ key: nextKey++, track }));

function shuffled<T>(items: T[]): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Listening bookkeeping for the current song (not React state).
const listening = {
  seconds: 0,
  lastTime: 0,
  counted: false,
  consecutiveErrors: 0,
  crossfading: false,
};

function resetListening(startAt = 0) {
  listening.seconds = 0;
  listening.lastTime = startAt;
  listening.counted = false;
  listening.crossfading = false;
}

// ============================================================
// Store
// ============================================================

// Filled in by the store below; installed on the engine by initPlayer().
let engineHandlers: Partial<EngineHandlers> | null = null;

export const usePlayer = create<PlayerStore>((set, get) => {
  const current = () => get().queue[get().index]?.track ?? null;

  /** Next playable index, or -1 at the end of the queue. */
  const findNext = (automatic: boolean): number => {
    const { index, queue, repeat } = get();
    if (automatic && repeat === 'one' && queue[index]) return index;

    for (let step = 1; step <= queue.length; step++) {
      let candidate = index + step;
      if (candidate >= queue.length) {
        if (repeat !== 'all') return -1;
        candidate -= queue.length;
      }
      if (queue[candidate].track.available) return candidate;
    }
    return -1;
  };

  const preloadNext = () => {
    const nextIndex = findNext(true);
    const nextTrack = nextIndex >= 0 && nextIndex !== get().index ? get().queue[nextIndex].track : null;
    getEngine().preload(nextTrack ? audioUrl(nextTrack.filePath) : null);
  };

  const startTrack = (index: number, { autoplay = true, startAt = 0 } = {}) => {
    const item = get().queue[index];
    if (!item) return;

    set({ index, duration: item.track.durationMs / 1000, loading: autoplay });
    resetListening(startAt);

    const engine = getEngine();
    engine.load(audioUrl(item.track.filePath), startAt);
    if (autoplay) {
      engine.play().catch(handlePlayRejection);
    }

    preloadNext();
    notifyPosition();
  };

  const stopAtEnd = () => {
    const engine = getEngine();
    engine.pause();
    engine.seek(0);
    set({ playing: false });
    notifyPosition();
  };

  const advance = (automatic: boolean) => {
    const nextIndex = findNext(automatic);
    if (nextIndex < 0) {
      stopAtEnd();
      return;
    }
    if (nextIndex === get().index) {
      // Repeat one, or a single-song queue on repeat all.
      getEngine().seek(0);
      resetListening();
      getEngine().play().catch(handlePlayRejection);
      return;
    }
    startTrack(nextIndex);
  };

  /** A rejected play() promise. */
  const handlePlayRejection = (error: unknown) => {
    const name = error instanceof DOMException ? error.name : '';
    // AbortError: interrupted by a newer load. NotSupportedError: the
    // element's 'error' event reports it, so handling it here too
    // would skip two songs.
    if (name === 'AbortError' || name === 'NotSupportedError') return;
    if (name === 'NotAllowedError') {
      set({ playing: false, loading: false });
      return;
    }
    handleError(String(error));
  };

  const handleError = (message: string) => {
    const track = current();
    listening.consecutiveErrors += 1;
    set({ loading: false });

    if (listening.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      toast("Several songs in a row couldn't be played, so playback stopped.", { tone: 'error' });
      listening.consecutiveErrors = 0;
      stopAtEnd();
      return;
    }

    toast(`Skipped "${track?.title ?? 'a song'}". ${message}`, { tone: 'error' });
    advance(true);
  };

  const countListening = () => {
    const now = getEngine().currentTime;
    const delta = now - listening.lastTime;
    listening.lastTime = now;

    // Only steady forward progress counts, not seeks.
    if (delta > 0 && delta < 1.5) listening.seconds += delta;

    const track = current();
    if (!track || listening.counted) return;

    const needed = Math.min(PLAY_COUNT_SECONDS, track.durationMs / 2000);
    if (listening.seconds >= needed) {
      listening.counted = true;
      api
        .recordPlay(track.id)
        .then(() => {
          const counted = { playCount: track.playCount + 1, lastPlayed: Date.now() };
          useLibrary.getState().patchTrack(track.id, counted);
          get().patchTrack(track.id, counted);
        })
        .catch((error) => console.warn('Could not record play:', error));
    }
  };

  const maybeStartCrossfade = () => {
    const seconds = useSettings.getState().crossfade;
    if (seconds === 0 || listening.crossfading || get().repeat === 'one') return;

    const engine = getEngine();
    const remaining = engine.duration - engine.currentTime;
    if (!engine.duration || remaining > seconds) return;

    const nextIndex = findNext(true);
    if (nextIndex < 0 || nextIndex === get().index) return;

    const nextTrack = get().queue[nextIndex].track;
    set({ index: nextIndex, duration: nextTrack.durationMs / 1000 });
    resetListening();
    listening.crossfading = true;
    engine.crossfadeTo(audioUrl(nextTrack.filePath), seconds).catch(handlePlayRejection);
    notifyPosition();
    // The new song is now playing; queue the one after it.
    window.setTimeout(preloadNext, seconds * 1000 + 50);
  };

  // Engine events land here. Handlers are installed lazily by
  // initPlayer() so nothing touches Audio during prerendering.
  const handlers = {
    onTimeUpdate: () => {
      countListening();
      maybeStartCrossfade();
    },
    onEnded: () => advance(true),
    onError: handleError,
    onPlayingChange: (playing: boolean) => {
      set({ playing });
      if (playing) {
        startPositionUpdates();
      } else {
        stopPositionUpdates();
      }
    },
    onLoadingChange: (loading: boolean) => {
      set({ loading });
      // Only real decoded audio proves a song works: browsers fire
      // 'play' before discovering a file is unplayable.
      if (!loading) listening.consecutiveErrors = 0;
    },
    onDuration: (seconds: number) => {
      if (seconds > 0) set({ duration: seconds });
    },
  };
  engineHandlers = handlers;

  return {
    queue: [],
    unshuffled: null,
    index: -1,
    source: null,
    playing: false,
    loading: false,
    duration: 0,
    volume: 0.8,
    muted: false,
    shuffle: false,
    repeat: 'off',

    playTracks: (tracks, { startIndex = 0, source, shuffle } = {}) => {
      if (tracks.length === 0) return;

      const items = toItems(tracks);
      const useShuffle = shuffle ?? get().shuffle;
      let queue = items;
      let index = Math.min(Math.max(startIndex, 0), items.length - 1);

      if (useShuffle) {
        // "Shuffle all" (shuffle: true, no start) starts anywhere; picking
        // a specific song while shuffle is on plays that song first.
        const first = shuffle && startIndex === 0 ? null : items[index];
        const rest = items.filter((item) => item !== first);
        queue = first ? [first, ...shuffled(rest)] : shuffled(rest);
        index = 0;
      }

      set({ queue, unshuffled: useShuffle ? items : null, shuffle: useShuffle, source: source ?? null });

      if (!queue[index].track.available) {
        set({ index });
        const playable = findNext(false);
        if (playable < 0) {
          toast("None of these songs can be found on disk. Try rescanning your library.", { tone: 'error' });
          return;
        }
        index = playable;
      }

      startTrack(index);
    },

    playNext: (tracks) => {
      if (get().queue.length === 0) return get().playTracks(tracks);
      const items = toItems(tracks);
      const { queue, index, unshuffled } = get();
      set({
        queue: [...queue.slice(0, index + 1), ...items, ...queue.slice(index + 1)],
        unshuffled: unshuffled ? [...unshuffled, ...items] : null,
      });
      preloadNext();
      toast(tracks.length === 1 ? `"${tracks[0].title}" plays next` : `${tracks.length} songs play next`);
    },

    addToQueue: (tracks) => {
      if (get().queue.length === 0) return get().playTracks(tracks);
      const items = toItems(tracks);
      set((state) => ({
        queue: [...state.queue, ...items],
        unshuffled: state.unshuffled ? [...state.unshuffled, ...items] : null,
      }));
      preloadNext();
      toast(tracks.length === 1 ? `Added "${tracks[0].title}" to the queue` : `Added ${tracks.length} songs to the queue`);
    },

    togglePlay: () => {
      const engine = getEngine();
      if (!current()) return;
      if (engine.paused) {
        engine.play().catch(handlePlayRejection);
      } else {
        engine.pause();
      }
    },

    next: () => advance(false),

    previous: () => {
      const engine = getEngine();
      const { index, queue, repeat } = get();

      if (engine.currentTime > RESTART_THRESHOLD_SECONDS || queue.length === 0) {
        engine.seek(0);
        notifyPosition();
        return;
      }

      for (let step = 1; step <= queue.length; step++) {
        let candidate = index - step;
        if (candidate < 0) {
          if (repeat !== 'all') break;
          candidate += queue.length;
        }
        if (queue[candidate].track.available) {
          startTrack(candidate);
          return;
        }
      }

      engine.seek(0);
      notifyPosition();
    },

    seek: (seconds) => {
      getEngine().seek(seconds);
      listening.lastTime = seconds;
      notifyPosition();
    },

    seekBy: (deltaSeconds) => get().seek(getEngine().currentTime + deltaSeconds),

    jumpTo: (index) => {
      if (get().queue[index]?.track.available) startTrack(index);
    },

    removeAt: (index) => {
      const { queue, index: currentIndex, unshuffled } = get();
      if (index === currentIndex || !queue[index]) return;
      const removed = queue[index];
      set({
        queue: queue.filter((_, i) => i !== index),
        unshuffled: unshuffled?.filter((item) => item.key !== removed.key) ?? null,
        index: index < currentIndex ? currentIndex - 1 : currentIndex,
      });
      preloadNext();
    },

    moveItem: (from, to) => {
      const { queue, index } = get();
      if (from === to || !queue[from]) return;
      const playingKey = queue[index]?.key;
      const reordered = queue.slice();
      const [moved] = reordered.splice(from, 1);
      reordered.splice(Math.min(to, reordered.length), 0, moved);
      set({ queue: reordered, index: reordered.findIndex((item) => item.key === playingKey) });
      preloadNext();
    },

    reorderUpcoming: (items) => {
      const { queue, index } = get();
      const start = index + 1;
      set({ queue: [...queue.slice(0, start), ...items, ...queue.slice(start + items.length)] });
      preloadNext();
    },

    clearUpcoming: () => {
      const { queue, index, unshuffled } = get();
      const kept = queue.slice(0, index + 1);
      const keptKeys = new Set(kept.map((item) => item.key));
      set({ queue: kept, unshuffled: unshuffled?.filter((item) => keptKeys.has(item.key)) ?? null });
      preloadNext();
    },

    setVolume: (volume) => {
      const clamped = Math.min(1, Math.max(0, volume));
      getEngine().setVolume(clamped);
      getEngine().setMuted(false);
      set({ volume: clamped, muted: false });
    },

    toggleMute: () => {
      const muted = !get().muted;
      getEngine().setMuted(muted);
      set({ muted });
    },

    toggleShuffle: () => {
      const { shuffle, queue, index, unshuffled } = get();
      const playing = queue[index];

      if (!shuffle) {
        const rest = queue.filter((_, i) => i !== index);
        set({
          shuffle: true,
          unshuffled: queue,
          queue: playing ? [playing, ...shuffled(rest)] : shuffled(rest),
          index: playing ? 0 : -1,
        });
      } else {
        // Restore the original order, keeping songs added meanwhile.
        const original = unshuffled ?? queue;
        const present = new Set(queue.map((item) => item.key));
        const known = new Set(original.map((item) => item.key));
        const restored = [
          ...original.filter((item) => present.has(item.key)),
          ...queue.filter((item) => !known.has(item.key)),
        ];
        set({
          shuffle: false,
          unshuffled: null,
          queue: restored,
          index: restored.findIndex((item) => item.key === playing?.key),
        });
      }
      preloadNext();
    },

    cycleRepeat: () => {
      const order: RepeatMode[] = ['off', 'all', 'one'];
      set({ repeat: order[(order.indexOf(get().repeat) + 1) % order.length] });
      preloadNext();
    },

    patchTrack: (trackId, patch) => {
      const update = (items: QueueItem[]) =>
        items.map((item) => (item.track.id === trackId ? { ...item, track: { ...item.track, ...patch } } : item));
      set((state) => ({
        queue: update(state.queue),
        unshuffled: state.unshuffled ? update(state.unshuffled) : null,
      }));
    },

    hydrateQueue: (state, startAt) => {
      set(state);
      const engine = getEngine();
      engine.setVolume(state.volume);
      engine.setMuted(state.muted);
      if (state.queue[state.index]) startTrack(state.index, { autoplay: false, startAt });
    },
  };
});

/** Connect the engine to the store. Call once, in the browser. */
export function initPlayer() {
  if (engineHandlers) getEngine().setHandlers(engineHandlers);
  getEngine().setVolume(usePlayer.getState().volume);
}

/** The track in the current queue slot, if any. */
export function useCurrentTrack(): Track | null {
  return usePlayer((state) => state.queue[state.index]?.track ?? null);
}
