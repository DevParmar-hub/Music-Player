'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { Disc3 } from 'lucide-react';

import { AlbumCard, CardGrid } from '@/components/library/Cards';
import { LibraryGate } from '@/components/library/LibraryGate';
import { EmptyState } from '@/components/ui/EmptyState';
import { Page, PageHeader } from '@/components/ui/PageHeader';
import { FilterInput, SortMenu } from '@/components/ui/SortMenu';
import {
  albumAddedDates,
  groupByAlbum,
  normalize,
  pluralize,
  sortAlbums,
  type AlbumSortKey,
} from '@/lib/library/select';
import { useLibrary } from '@/lib/stores/library';

const SORTS: { value: AlbumSortKey; label: string }[] = [
  { value: 'title', label: 'Title' },
  { value: 'artist', label: 'Artist' },
  { value: 'year', label: 'Year' },
  { value: 'added', label: 'Recently added' },
];

export default function AlbumsPage() {
  const albums = useLibrary((state) => state.albums);
  const tracks = useLibrary((state) => state.tracks);
  const [sort, setSort] = useState<AlbumSortKey>('title');
  const [filter, setFilter] = useState('');
  const deferredFilter = useDeferredValue(filter);

  const tracksByAlbum = useMemo(() => groupByAlbum(tracks), [tracks]);
  const addedDates = useMemo(() => albumAddedDates(tracks), [tracks]);

  const visible = useMemo(() => {
    const terms = normalize(deferredFilter).split(/\s+/).filter(Boolean);
    const matching = terms.length
      ? albums.filter((album) => {
          const haystack = normalize(`${album.title} ${album.artistName ?? ''}`);
          return terms.every((term) => haystack.includes(term));
        })
      : albums;
    return sortAlbums(matching, sort, addedDates);
  }, [albums, deferredFilter, sort, addedDates]);

  return (
    <Page>
      <PageHeader
        eyebrow="Library"
        title="Albums"
        description={albums.length > 0 && pluralize(albums.length, 'album')}
      />
      <LibraryGate>
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FilterInput value={filter} onChange={setFilter} placeholder="Filter albums" />
            <SortMenu options={SORTS} value={sort} onChange={setSort} />
          </div>
          {visible.length === 0 ? (
            <EmptyState icon={<Disc3 className="size-6" />} title="Nothing matches">
              Try a different word, or clear the filter.
            </EmptyState>
          ) : (
            <CardGrid>
              {visible.map((album) => (
                <AlbumCard key={album.id} album={album} tracks={tracksByAlbum.get(album.id) ?? []} />
              ))}
            </CardGrid>
          )}
        </div>
      </LibraryGate>
    </Page>
  );
}
