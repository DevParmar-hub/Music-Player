// Global playback shortcuts:
//   Space          play / pause
//   Ctrl + → / ←   next / previous song
//   Shift + → / ←  seek 10 seconds
//   Ctrl + ↑ / ↓   volume
//   M              mute

import { usePlayer } from './store';

const SEEK_SECONDS = 10;
const VOLUME_STEP = 0.05;

/** Typing in a field, or keys a focused control handles itself. */
function belongsToFocusedElement(event: KeyboardEvent): boolean {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return true;
  // Space activates focused buttons and links; arrows move sliders.
  if (event.key === ' ' && (target.tagName === 'BUTTON' || target.tagName === 'A')) return true;
  if (event.key.startsWith('Arrow') && target.getAttribute('role') === 'slider') return true;
  return false;
}

export function connectShortcuts(): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.metaKey || belongsToFocusedElement(event)) return;

    const player = usePlayer.getState();
    const ctrl = event.ctrlKey;
    let handled = true;

    if (event.key === ' ' && !ctrl && !event.shiftKey) player.togglePlay();
    else if (event.key === 'ArrowRight' && ctrl) player.next();
    else if (event.key === 'ArrowLeft' && ctrl) player.previous();
    else if (event.key === 'ArrowRight' && event.shiftKey) player.seekBy(SEEK_SECONDS);
    else if (event.key === 'ArrowLeft' && event.shiftKey) player.seekBy(-SEEK_SECONDS);
    else if (event.key === 'ArrowUp' && ctrl) player.setVolume(player.volume + VOLUME_STEP);
    else if (event.key === 'ArrowDown' && ctrl) player.setVolume(player.volume - VOLUME_STEP);
    else if (event.key.toLowerCase() === 'm' && !ctrl && !event.shiftKey) player.toggleMute();
    else handled = false;

    if (handled) event.preventDefault();
  };

  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}
