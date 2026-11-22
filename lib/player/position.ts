// The playhead changes every frame, far too often for the player
// store. Components that show it subscribe here instead; only they
// re-render, and only while music is playing.

import { useSyncExternalStore } from 'react';

import { getEngine } from './engine';

const listeners = new Set<() => void>();
let frame = 0;

function tick() {
  notifyPosition();
  frame = requestAnimationFrame(tick);
}

/** Start per-frame updates (called when playback starts). */
export function startPositionUpdates() {
  if (!frame) frame = requestAnimationFrame(tick);
}

/** Stop per-frame updates (called on pause). */
export function stopPositionUpdates() {
  cancelAnimationFrame(frame);
  frame = 0;
  notifyPosition();
}

/** Tell subscribers the position jumped (seek, new track). */
export function notifyPosition() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Current playhead in seconds. */
export function usePlaybackPosition(): number {
  return useSyncExternalStore(
    subscribe,
    () => getEngine().currentTime,
    () => 0,
  );
}
