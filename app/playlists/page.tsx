'use client';

import { ListMusic } from 'lucide-react';

import { UpcomingPage } from '@/components/ui/UpcomingPage';

export default function PlaylistsPage() {
  return (
    <UpcomingPage
      eyebrow="Library"
      title="Playlists"
      icon={<ListMusic className="size-6" />}
      heading="Playlists, coming in Stage 6"
    >
      Create, reorder and sync playlists to folders. Smart playlists like Most Played and Recently Added appear here too.
    </UpcomingPage>
  );
}
