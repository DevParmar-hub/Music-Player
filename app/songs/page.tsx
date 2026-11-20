'use client';

import { Music2 } from 'lucide-react';

import { UpcomingPage } from '@/components/ui/UpcomingPage';

export default function SongsPage() {
  return (
    <UpcomingPage
      eyebrow="Library"
      title="Songs"
      icon={<Music2 className="size-6" />}
      heading="Your songs, coming in Stage 3"
    >
      A fast, sortable list of every song, built to stay smooth with tens of thousands of tracks.
    </UpcomingPage>
  );
}
