'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { MicVocal, MoreHorizontal, Play, Shuffle } from 'lucide-react';

import { AlbumCard, CardGrid } from '@/components/library/Cards';
import { CollectionHero } from '@/components/library/CollectionHero';
import { LibraryGate } from '@/components/library/LibraryGate';
import { TrackList } from '@/components/library/TrackList';
import { openMenuFrom, TrackMenu } from '@/components/library/TrackMenu';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Page } from '@/components/ui/PageHeader';
import {
  artistTracks,
  describeDuration,
  groupByAlbum,
  pluralize,
  sortAlbums,
  totalDuration,
} from '@/lib/library/select';
import { usePlayer } from '@/lib/player/store';
import { useLibrary } from '@/lib/stores/library';

const POPULAR_COUNT = 5;
const SONGS_PREVIEW = 10;

export default function ArtistPage() {
  return (
    <Suspense>
      <Page>
        <LibraryGate>
          <ArtistView />
        </LibraryGate>
      </Page>
    </Suspense>
  );
}

function ArtistView() {
  const id = Number(useSearchParams().get('id'));
  const artists = useLibrary((state) => state.artists);
  const albums = useLibrary((state) => state.albums);
  const tracks = useLibrary((state) => state.tracks);
  const [showAllSongs, setShowAllSongs] = useState(false);

  const artist = artists.find((candidate) => candidate.id === id);
  const songs = useMemo(() => artistTracks(tracks, id), [tracks, id]);

  // Most played first; with no plays yet, simply the first few songs.
  const popular = useMemo(() => {
    const played = songs.filter((song) => song.playCount > 0);
    return (played.length > 0 ? played.sort((a, b) => b.playCount - a.playCount) : songs).slice(0, POPULAR_COUNT);
  }, [songs]);

  // The artist's own albums, plus albums they appear on.
  const artistAlbums = useMemo(() => {
    const albumIds = new Set(songs.map((song) => song.albumId));
    const related = albums.filter((album) => album.artistId === id || albumIds.has(album.id));
    return sortAlbums(related, 'year', new Map());
  }, [albums, songs, id]);
  const tracksByAlbum = useMemo(() => groupByAlbum(tracks), [tracks]);

  if (!artist) {
    return (
      <EmptyState icon={<MicVocal className="size-6" />} title="Artist not found">
        They may have been removed by the last scan.{' '}
        <Link href="/artists" className="text-accent-text hover:underline">
          Back to artists
        </Link>
      </EmptyState>
    );
  }

  const source = `Artist · ${artist.name}`;
  const play = (shuffle: boolean) => usePlayer.getState().playTracks(songs, { source, shuffle });
  const shownSongs = showAllSongs ? songs : songs.slice(0, SONGS_PREVIEW);

  return (
    <div className="flex flex-col gap-12">
      <CollectionHero
        eyebrow="Artist"
        title={artist.name}
        artworkHash={artist.artworkHash}
        round
        meta={[
          pluralize(artistAlbums.length, 'album'),
          pluralize(songs.length, 'song'),
          describeDuration(totalDuration(songs)),
        ].join(' · ')}
        actions={
          <>
            <Button variant="primary" icon={<Play className="size-4 fill-current" />} onClick={() => play(false)}>
              Play
            </Button>
            <Button icon={<Shuffle className="size-4" />} onClick={() => play(true)}>
              Shuffle
            </Button>
            <TrackMenu tracks={songs} source={source}>
              <IconButton label="More options" onClick={openMenuFrom}>
                <MoreHorizontal className="size-5" />
              </IconButton>
            </TrackMenu>
          </>
        }
      />

      {popular.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-3xl text-fg">Popular</h2>
          <TrackList tracks={popular} variant="compact" source={source} />
        </section>
      )}

      {artistAlbums.length > 0 && (
        <section className="flex flex-col gap-5">
          <h2 className="font-display text-3xl text-fg">Albums</h2>
          <CardGrid>
            {artistAlbums.map((album) => (
              <AlbumCard key={album.id} album={album} tracks={tracksByAlbum.get(album.id) ?? []} />
            ))}
          </CardGrid>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-3xl text-fg">All songs</h2>
        <TrackList tracks={shownSongs} variant="library" source={source} queue={{ tracks: songs, offset: 0 }} />
        {songs.length > SONGS_PREVIEW && (
          <Button variant="ghost" size="sm" className="self-start" onClick={() => setShowAllSongs(!showAllSongs)}>
            {showAllSongs ? 'Show fewer' : `Show all ${songs.length.toLocaleString()} songs`}
          </Button>
        )}
      </section>
    </div>
  );
}
