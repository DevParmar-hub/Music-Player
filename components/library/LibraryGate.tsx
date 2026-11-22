'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { CircleAlert, FolderPlus, LoaderCircle } from 'lucide-react';

import { Button, buttonClass } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useLibrary } from '@/lib/stores/library';

/** Shows loading, error and "no music yet" states; children when ready. */
export function LibraryGate({ children }: { children: ReactNode }) {
  const status = useLibrary((state) => state.status);
  const error = useLibrary((state) => state.error);
  const empty = useLibrary((state) => state.tracks.length === 0);
  const load = useLibrary((state) => state.load);

  if (status === 'idle' || status === 'loading') {
    return (
      <div role="status" className="flex items-center justify-center gap-3 py-24 text-sm text-fg-muted">
        <LoaderCircle className="size-4 animate-spin text-accent-text" /> Loading your library…
      </div>
    );
  }

  if (status === 'error') {
    return (
      <EmptyState
        icon={<CircleAlert className="size-6" />}
        title="Your library couldn't be loaded"
        action={<Button onClick={load}>Try again</Button>}
      >
        {error}
      </EmptyState>
    );
  }

  if (empty) {
    return (
      <EmptyState
        icon={<FolderPlus className="size-6" />}
        title="No music yet"
        action={
          <Link href="/" className={buttonClass('primary')}>
            Add your music
          </Link>
        }
      >
        Choose the folder your music lives in and it will appear here.
      </EmptyState>
    );
  }

  return children;
}
