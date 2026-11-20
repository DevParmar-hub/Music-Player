'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { FolderPlus, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Page, PageHeader } from '@/components/ui/PageHeader';
import { ScanProgressCard } from '@/components/library/ScanProgressCard';
import { useScan } from '@/lib/stores/scan';

function greeting(hour: number): string {
  if (hour < 5) return 'Late night listening';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// The hour only matters on the client; the static export renders a
// neutral title that is replaced after hydration.
const subscribeNever = () => () => {};

export default function Home() {
  const title = useSyncExternalStore(
    subscribeNever,
    () => greeting(new Date().getHours()),
    () => 'Welcome back',
  );
  const roots = useScan((state) => state.roots);
  const stats = useScan((state) => state.stats);
  const running = useScan((state) => state.running);
  const addFolder = useScan((state) => state.addFolder);

  const hasLibrary = (stats?.trackCount ?? 0) > 0;

  return (
    <Page>
      <PageHeader eyebrow="Home" title={title} />

      {running && <ScanProgressCard />}

      {roots.length === 0 && !running ? (
        <EmptyState
          icon={<FolderPlus className="size-6" />}
          title="Bring your music in"
          action={
            <Button variant="primary" icon={<FolderPlus className="size-4" />} onClick={addFolder}>
              Choose music folder
            </Button>
          }
        >
          Point us at the folder where your music lives. We read your files where they are and
          never move or change them.
        </EmptyState>
      ) : (
        hasLibrary &&
        stats && (
          <section aria-label="Library overview" className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Songs" value={stats.trackCount.toLocaleString()} />
            <Stat label="Albums" value={stats.albumCount.toLocaleString()} />
            <Stat label="Artists" value={stats.artistCount.toLocaleString()} />
            <Stat label="Hours of music" value={formatHours(stats.totalDurationMs)} />
          </section>
        )
      )}

      {hasLibrary && (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface/60 px-5 py-4 text-sm text-fg-muted">
          <Sparkles className="size-4 shrink-0 text-love-text" />
          <span className="flex-1">
            Recently added, most played and your smart playlists will live here.
          </span>
          <Link href="/settings" className="text-accent-text hover:underline">
            Library settings
          </Link>
        </div>
      )}
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border bg-surface/60 px-5 py-4">
      <span className="font-display text-4xl leading-none text-fg tabular-nums">{value}</span>
      <span className="text-xs tracking-wide text-fg-muted uppercase">{label}</span>
    </div>
  );
}

function formatHours(milliseconds: number): string {
  const hours = milliseconds / 3_600_000;
  return hours < 10 ? hours.toFixed(1) : Math.round(hours).toLocaleString();
}
