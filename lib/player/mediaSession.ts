// Windows media integration: hardware media keys and the media flyout
// (title, artist, cover) come from the Media Session API, which the
// WebView2 runtime connects to Windows' media controls.

import { artworkUrl, loadArtworkDirectory } from '@/lib/tauri/assets';
import { getEngine } from './engine';
import { usePlayer } from './store';

const SEEK_STEP_SECONDS = 10;

export function connectMediaSession(): () => void {
  if (!('mediaSession' in navigator)) return () => {};

  const session = navigator.mediaSession;
  const player = () => usePlayer.getState();

  const actions: [MediaSessionAction, MediaSessionActionHandler][] = [
    ['play', () => player().togglePlay()],
    ['pause', () => player().togglePlay()],
    ['previoustrack', () => player().previous()],
    ['nexttrack', () => player().next()],
    ['seekbackward', (details) => player().seekBy(-(details.seekOffset ?? SEEK_STEP_SECONDS))],
    ['seekforward', (details) => player().seekBy(details.seekOffset ?? SEEK_STEP_SECONDS)],
    ['seekto', (details) => details.seekTime !== undefined && player().seek(details.seekTime)],
  ];

  for (const [action, handler] of actions) {
    try {
      session.setActionHandler(action, handler);
    } catch {
      // Unsupported action in this runtime.
    }
  }

  const updatePosition = () => {
    const engine = getEngine();
    if (!engine.duration) return;
    try {
      session.setPositionState({
        duration: engine.duration,
        position: Math.min(engine.currentTime, engine.duration),
        playbackRate: 1,
      });
    } catch {
      // Ignore transient invalid states while a track loads.
    }
  };

  let artworkDirectory: string | null = null;
  loadArtworkDirectory()
    .then((directory) => {
      artworkDirectory = directory;
      updateMetadata();
    })
    .catch(() => {});

  let lastTrackId: number | null = null;
  const updateMetadata = () => {
    const track = player().queue[player().index]?.track ?? null;
    lastTrackId = track?.id ?? null;

    if (!track) {
      session.metadata = null;
      return;
    }

    session.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artistName ?? '',
      album: track.albumTitle ?? '',
      artwork:
        track.artworkHash && artworkDirectory
          ? [{ src: artworkUrl(artworkDirectory, track.artworkHash, 'full'), sizes: '1200x1200', type: 'image/jpeg' }]
          : [],
    });
  };

  const unsubscribe = usePlayer.subscribe((state, previous) => {
    const trackId = state.queue[state.index]?.track.id ?? null;
    if (trackId !== lastTrackId) updateMetadata();

    if (state.playing !== previous.playing) {
      session.playbackState = state.playing ? 'playing' : 'paused';
      updatePosition();
    }

    if (state.duration !== previous.duration) updatePosition();
  });

  updateMetadata();

  return () => {
    unsubscribe();
    for (const [action] of actions) {
      try {
        session.setActionHandler(action, null);
      } catch {
        // Ignore.
      }
    }
  };
}
