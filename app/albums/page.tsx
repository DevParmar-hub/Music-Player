'use client';

import { Disc3 } from 'lucide-react';

import { UpcomingPage } from '@/components/ui/UpcomingPage';

export default function AlbumsPage() {
  return (
    <UpcomingPage
      eyebrow="Library"
      title="Albums"
      icon={<Disc3 className="size-6" />}
      heading="Album covers, coming in Stage 3"
    >
      A grid of every album with its cover art, opening into a detail page per album.
    </UpcomingPage>
  );
}
