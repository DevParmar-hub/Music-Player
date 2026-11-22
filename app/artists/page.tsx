'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { MicVocal } from 'lucide-react';

import { ArtistCard, CardGrid } from '@/components/library/Cards';
import { LibraryGate } from '@/components/library/LibraryGate';
import { EmptyState } from '@/components/ui/EmptyState';
import { Page, PageHeader } from '@/components/ui/PageHeader';
import { FilterInput, SortMenu } from '@/components/ui/SortMenu';
import { groupByArtist, normalize, pluralize, sortArtists } from '@/lib/library/select';
import { useLibrary } from '@/lib/stores/library';

const SORTS: { value: 'name' | 'tracks'; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'tracks', label: 'Most songs' },
];

export default function ArtistsPage() {
  const artists = useLibrary((state) => state.artists);
  const tracks = useLibrary((state) => state.tracks);
  const [sort, setSort] = useState<'name' | 'tracks'>('name');
  const [filter, setFilter] = useState('');
  const deferredFilter = useDeferredValue(filter);

  const tracksByArtist = useMemo(() => groupByArtist(tracks), [tracks]);

  const visible = useMemo(() => {
    const terms = normalize(deferredFilter).split(/\s+/).filter(Boolean);
    const matching = terms.length
      ? artists.filter((artist) => terms.every((term) => normalize(artist.name).includes(term)))
      : artists;
    return sortArtists(matching, sort);
  }, [artists, deferredFilter, sort]);

  return (
    <Page>
      <PageHeader
        eyebrow="Library"
        title="Artists"
        description={artists.length > 0 && pluralize(artists.length, 'artist')}
      />
      <LibraryGate>
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FilterInput value={filter} onChange={setFilter} placeholder="Filter artists" />
            <SortMenu options={SORTS} value={sort} onChange={setSort} />
          </div>
          {visible.length === 0 ? (
            <EmptyState icon={<MicVocal className="size-6" />} title="Nothing matches">
              Try a different word, or clear the filter.
            </EmptyState>
          ) : (
            <CardGrid>
              {visible.map((artist) => (
                <ArtistCard key={artist.id} artist={artist} tracks={tracksByArtist.get(artist.id) ?? []} />
              ))}
            </CardGrid>
          )}
        </div>
      </LibraryGate>
    </Page>
  );
}
