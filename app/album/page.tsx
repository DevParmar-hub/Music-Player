'use client';

import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Disc3, MoreHorizontal, Play, Shuffle } from 'lucide-react';

import { AlbumCard, CardGrid } from '@/components/library/Cards';
import { CollectionHero } from '@/components/library/CollectionHero';
import { LibraryGate } from '@/components/library/LibraryGate';
import { TrackList } from '@/components/library/TrackList';
import { openMenuFrom, TrackMenu } from '@/components/library/TrackMenu';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Page } from '@/components/ui/PageHeader';
import { albumTracks, describeDuration, groupByAlbum, pluralize, totalDuration } from '@/lib/library/select';
import { usePlayer } from '@/lib/player/store';
import { useLibrary } from '@/lib/stores/library';

export default function AlbumPage() {
  return (
    <Suspense>
      <Page>
        <LibraryGate>
          <AlbumView />
        </LibraryGate>
      </Page>
    </Suspense>
  );
}

function AlbumView() {
  const id = Number(useSearchParams().get('id'));
  const albums = useLibrary((state) => state.albums);
  const tracks = useLibrary((state) => state.tracks);

  const album = albums.find((candidate) => candidate.id === id);
  const songs = useMemo(() => albumTracks(tracks, id), [tracks, id]);

  // Songs are already in disc order, so each disc is a contiguous run.
  const discs = useMemo(() => {
    const runs: { disc: number; offset: number; songs: typeof songs }[] = [];
    songs.forEach((song, index) => {
      const disc = song.discNumber ?? 1;
      const last = runs[runs.length - 1];
      if (last && last.disc === disc) last.songs.push(song);
      else runs.push({ disc, offset: index, songs: [song] });
    });
    return runs;
  }, [songs]);

  const moreByArtist = useMemo(
    () => albums.filter((other) => other.artistId !== null && other.artistId === album?.artistId && other.id !== id),
    [albums, album?.artistId, id],
  );
  const tracksByAlbum = useMemo(() => groupByAlbum(tracks), [tracks]);

  if (!album) {
    return (
      <EmptyState icon={<Disc3 className="size-6" />} title="Album not found">
        It may have been removed by the last scan.{' '}
        <Link href="/albums" className="text-accent-text hover:underline">
          Back to albums
        </Link>
      </EmptyState>
    );
  }

  const source = `Album · ${album.title}`;
  const play = (shuffle: boolean) => usePlayer.getState().playTracks(songs, { source, shuffle });

  return (
    <div className="flex flex-col gap-12">
      <CollectionHero
        eyebrow="Album"
        title={album.title}
        artworkHash={album.artworkHash}
        subtitle={
          album.artistId !== null ? (
            <Link href={`/artist?id=${album.artistId}`} className="font-medium hover:underline">
              {album.artistName}
            </Link>
          ) : (
            'Various artists'
          )
        }
        meta={[album.year, pluralize(songs.length, 'song'), describeDuration(totalDuration(songs))]
          .filter(Boolean)
          .join(' · ')}
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

      <section aria-label="Songs" className="flex flex-col gap-6">
        {discs.map(({ disc, offset, songs: discSongs }) => (
          <div key={disc} className="flex flex-col gap-2">
            {discs.length > 1 && (
              <h2 className="flex items-center gap-2 px-3 text-sm font-medium text-fg-muted">
                <Disc3 className="size-4" /> Disc {disc}
              </h2>
            )}
            <TrackList
              tracks={discSongs}
              variant="album"
              source={source}
              albumArtistId={album.artistId}
              queue={{ tracks: songs, offset }}
            />
          </div>
        ))}
      </section>

      {moreByArtist.length > 0 && (
        <section className="flex flex-col gap-5">
          <h2 className="font-display text-3xl text-fg">More by {album.artistName}</h2>
          <CardGrid>
            {moreByArtist.map((other) => (
              <AlbumCard key={other.id} album={other} tracks={tracksByAlbum.get(other.id) ?? []} />
            ))}
          </CardGrid>
        </section>
      )}
    </div>
  );
}
