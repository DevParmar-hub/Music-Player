// Pure helpers that slice, sort and search the library in memory.
// Ten thousand tracks sort in a few milliseconds, so every view works
// from the one loaded list instead of asking the backend.

import type { Album, Artist, Track } from '@/lib/tauri/types';

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/** Lowercase without accents, so "beyonce" finds "Beyoncé". */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

// ============================================================
// Tracks
// ============================================================

export type TrackSortKey = 'title' | 'artist' | 'album' | 'added' | 'duration' | 'plays';
export type SortDirection = 'asc' | 'desc';

export function sortTracks(tracks: Track[], key: TrackSortKey, direction: SortDirection): Track[] {
  const sign = direction === 'asc' ? 1 : -1;
  const text = (value: string | null) => value ?? '￿'; // unknowns last

  const compare: Record<TrackSortKey, (a: Track, b: Track) => number> = {
    title: (a, b) => collator.compare(a.title, b.title),
    artist: (a, b) =>
      collator.compare(text(a.artistName), text(b.artistName)) || inAlbumOrder(a, b),
    album: (a, b) => collator.compare(text(a.albumTitle), text(b.albumTitle)) || inAlbumOrder(a, b),
    added: (a, b) => a.dateAdded - b.dateAdded,
    duration: (a, b) => a.durationMs - b.durationMs,
    plays: (a, b) => a.playCount - b.playCount,
  };

  return tracks.slice().sort((a, b) => sign * compare[key](a, b) || collator.compare(a.title, b.title));
}

/** Disc, then track number, then title. */
export function inAlbumOrder(a: Track, b: Track): number {
  return (
    (a.discNumber ?? 1) - (b.discNumber ?? 1) ||
    (a.trackNumber ?? Number.MAX_SAFE_INTEGER) - (b.trackNumber ?? Number.MAX_SAFE_INTEGER) ||
    collator.compare(a.title, b.title)
  );
}

export function albumTracks(tracks: Track[], albumId: number): Track[] {
  return tracks.filter((track) => track.albumId === albumId).sort(inAlbumOrder);
}

export function artistTracks(tracks: Track[], artistId: number): Track[] {
  return tracks
    .filter((track) => track.artistId === artistId)
    .sort((a, b) => collator.compare(a.albumTitle ?? '', b.albumTitle ?? '') || inAlbumOrder(a, b));
}

export function totalDuration(tracks: Track[]): number {
  return tracks.reduce((sum, track) => sum + track.durationMs, 0);
}

/** "48 min" or "3 hr 12 min". */
export function describeDuration(milliseconds: number): string {
  const minutes = Math.round(milliseconds / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

export function pluralize(count: number, word: string): string {
  return `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`;
}

// ============================================================
// Albums and artists
// ============================================================

export type AlbumSortKey = 'title' | 'artist' | 'year' | 'added';

/** When each album first appeared, from its newest track. */
export function albumAddedDates(tracks: Track[]): Map<number, number> {
  const dates = new Map<number, number>();
  for (const track of tracks) {
    if (track.albumId === null) continue;
    dates.set(track.albumId, Math.max(dates.get(track.albumId) ?? 0, track.dateAdded));
  }
  return dates;
}

export function sortAlbums(albums: Album[], key: AlbumSortKey, addedDates: Map<number, number>): Album[] {
  const compare: Record<AlbumSortKey, (a: Album, b: Album) => number> = {
    title: (a, b) => collator.compare(a.title, b.title),
    artist: (a, b) =>
      collator.compare(a.artistName ?? '￿', b.artistName ?? '￿') || (a.year ?? 0) - (b.year ?? 0),
    year: (a, b) => (b.year ?? 0) - (a.year ?? 0),
    added: (a, b) => (addedDates.get(b.id) ?? 0) - (addedDates.get(a.id) ?? 0),
  };
  return albums.slice().sort((a, b) => compare[key](a, b) || collator.compare(a.title, b.title));
}

export function sortArtists(artists: Artist[], key: 'name' | 'tracks'): Artist[] {
  return artists
    .slice()
    .sort((a, b) =>
      key === 'tracks'
        ? b.trackCount - a.trackCount || collator.compare(a.name, b.name)
        : collator.compare(a.name, b.name),
    );
}

// ============================================================
// Search
// ============================================================

export interface SearchResults {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
}

/**
 * Rank: whole-name match, then prefix, then word prefix, then anywhere.
 * Tracks also match on artist and album, so "radiohead creep" works.
 */
export function searchLibrary(
  query: string,
  library: { tracks: Track[]; albums: Album[]; artists: Artist[] },
  limits = { tracks: 8, albums: 5, artists: 5 },
): SearchResults {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return { tracks: [], albums: [], artists: [] };

  const phrase = terms.join(' ');

  const score = (name: string, haystack: string): number => {
    if (!terms.every((term) => haystack.includes(term))) return -1;
    const normalizedName = normalize(name);
    if (normalizedName === phrase) return 4;
    if (normalizedName.startsWith(phrase)) return 3;
    if (normalizedName.split(/\s+/).some((word) => word.startsWith(terms[0]))) return 2;
    return 1;
  };

  const rank = <T,>(items: T[], name: (item: T) => string, haystack: (item: T) => string, limit: number) =>
    items
      .map((item) => ({ item, score: score(name(item), haystack(item)) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || collator.compare(name(a.item), name(b.item)))
      .slice(0, limit)
      .map((entry) => entry.item);

  return {
    tracks: rank(
      library.tracks,
      (track) => track.title,
      (track) => normalize(`${track.title} ${track.artistName ?? ''} ${track.albumTitle ?? ''}`),
      limits.tracks,
    ),
    albums: rank(
      library.albums,
      (album) => album.title,
      (album) => normalize(`${album.title} ${album.artistName ?? ''}`),
      limits.albums,
    ),
    artists: rank(library.artists, (artist) => artist.name, (artist) => normalize(artist.name), limits.artists),
  };
}

// ============================================================
// Grouping
// ============================================================

/** Tracks per album, in album order. One pass, for grids of cards. */
export function groupByAlbum(tracks: Track[]): Map<number, Track[]> {
  const groups = new Map<number, Track[]>();
  for (const track of tracks) {
    if (track.albumId === null) continue;
    const group = groups.get(track.albumId);
    if (group) group.push(track);
    else groups.set(track.albumId, [track]);
  }
  for (const group of groups.values()) group.sort(inAlbumOrder);
  return groups;
}

/** Tracks per artist. */
export function groupByArtist(tracks: Track[]): Map<number, Track[]> {
  const groups = new Map<number, Track[]>();
  for (const track of tracks) {
    if (track.artistId === null) continue;
    const group = groups.get(track.artistId);
    if (group) group.push(track);
    else groups.set(track.artistId, [track]);
  }
  return groups;
}
