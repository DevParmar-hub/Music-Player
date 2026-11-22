'use client';

import { Suspense, useDeferredValue, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Heart, Play, Shuffle } from 'lucide-react';

import { LibraryGate } from '@/components/library/LibraryGate';
import { VirtualTrackList } from '@/components/library/TrackList';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Page, PageHeader } from '@/components/ui/PageHeader';
import { FilterInput, SortMenu } from '@/components/ui/SortMenu';
import { cn } from '@/lib/cn';
import {
  describeDuration,
  normalize,
  pluralize,
  sortTracks,
  totalDuration,
  type SortDirection,
  type TrackSortKey,
} from '@/lib/library/select';
import { usePlayer } from '@/lib/player/store';
import { useLibrary } from '@/lib/stores/library';

const SORTS: { value: TrackSortKey; label: string }[] = [
  { value: 'title', label: 'Title' },
  { value: 'artist', label: 'Artist' },
  { value: 'album', label: 'Album' },
  { value: 'added', label: 'Recently added' },
  { value: 'plays', label: 'Most played' },
  { value: 'duration', label: 'Length' },
];

/** Text sorts start A→Z; numeric ones start with the biggest. */
const DEFAULT_DIRECTION: Record<TrackSortKey, SortDirection> = {
  title: 'asc',
  artist: 'asc',
  album: 'asc',
  added: 'desc',
  plays: 'desc',
  duration: 'desc',
};

export default function SongsPage() {
  // useSearchParams needs a Suspense boundary in a static export.
  return (
    <Suspense>
      <Songs />
    </Suspense>
  );
}

function Songs() {
  const likedOnly = useSearchParams().get('liked') === '1';
  const tracks = useLibrary((state) => state.tracks);

  const [sort, setSort] = useState<TrackSortKey>(likedOnly ? 'added' : 'title');
  const [direction, setDirection] = useState<SortDirection>(DEFAULT_DIRECTION[likedOnly ? 'added' : 'title']);
  const [filter, setFilter] = useState('');
  // Typing stays instant; the list catches up a frame later.
  const deferredFilter = useDeferredValue(filter);

  const visible = useMemo(() => {
    let list = likedOnly ? tracks.filter((track) => track.favorite) : tracks;
    const terms = normalize(deferredFilter).split(/\s+/).filter(Boolean);
    if (terms.length > 0) {
      list = list.filter((track) => {
        const haystack = normalize(`${track.title} ${track.artistName ?? ''} ${track.albumTitle ?? ''}`);
        return terms.every((term) => haystack.includes(term));
      });
    }
    return sortTracks(list, sort, direction);
  }, [tracks, likedOnly, deferredFilter, sort, direction]);

  const title = likedOnly ? 'Liked songs' : 'Songs';
  const play = (shuffle: boolean) =>
    usePlayer.getState().playTracks(visible, { source: title, shuffle });

  return (
    <Page>
      <PageHeader
        eyebrow="Library"
        title={title}
        description={
          visible.length > 0 && `${pluralize(visible.length, 'song')} · ${describeDuration(totalDuration(visible))}`
        }
        actions={
          visible.length > 0 && (
            <>
              <Button variant="primary" icon={<Play className="size-4 fill-current" />} onClick={() => play(false)}>
                Play
              </Button>
              <Button icon={<Shuffle className="size-4" />} onClick={() => play(true)}>
                Shuffle
              </Button>
            </>
          )
        }
      />

      <LibraryGate>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FilterInput value={filter} onChange={setFilter} placeholder={`Filter ${title.toLowerCase()}`} />
              <Link
                href={likedOnly ? '/songs' : '/songs?liked=1'}
                aria-pressed={likedOnly}
                className={cn(
                  'flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors',
                  likedOnly
                    ? 'border-transparent bg-love-soft text-love-text'
                    : 'border-border bg-surface-2/60 text-fg-muted hover:text-fg',
                )}
              >
                <Heart className={cn('size-3.5', likedOnly && 'fill-current')} /> Liked
              </Link>
            </div>
            <SortMenu
              options={SORTS}
              value={sort}
              onChange={(next) => {
                setSort(next);
                setDirection(DEFAULT_DIRECTION[next]);
              }}
              direction={direction}
              onDirectionChange={setDirection}
            />
          </div>

          {visible.length === 0 ? (
            <EmptyState icon={<Heart className="size-6" />} title={likedOnly && !filter ? 'No liked songs yet' : 'Nothing matches'}>
              {likedOnly && !filter
                ? 'Tap the heart on any song and it will show up here.'
                : 'Try a different word, or clear the filter.'}
            </EmptyState>
          ) : (
            <VirtualTrackList tracks={visible} variant="library" source={title} />
          )}
        </div>
      </LibraryGate>
    </Page>
  );
}
