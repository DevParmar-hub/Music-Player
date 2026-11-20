// URLs for local files served through Tauri's asset protocol. The
// backend grants access to the library folders and the artwork cache.

import { convertFileSrc } from '@tauri-apps/api/core';

import { getArtworkDirectory } from './api';

let artworkDirectory: Promise<string> | null = null;

/** Resolve the artwork cache folder once; call before artworkUrl. */
export function loadArtworkDirectory(): Promise<string> {
  artworkDirectory ??= getArtworkDirectory();
  return artworkDirectory;
}

/**
 * URL of a cached cover. `thumb` is 320px, for lists and grids;
 * `full` is up to 1200px, for Now Playing.
 */
export function artworkUrl(
  directory: string,
  hash: string,
  size: 'thumb' | 'full' = 'thumb',
): string {
  const separator = directory.includes('\\') ? '\\' : '/';
  const file = size === 'thumb' ? `${hash}-thumb.jpg` : `${hash}.jpg`;
  return convertFileSrc(`${directory}${separator}${file}`);
}

/** Streamable URL for an audio file inside a library folder. */
export function audioUrl(filePath: string): string {
  return convertFileSrc(filePath);
}
