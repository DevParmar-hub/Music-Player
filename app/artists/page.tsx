'use client';

import { MicVocal } from 'lucide-react';

import { UpcomingPage } from '@/components/ui/UpcomingPage';

export default function ArtistsPage() {
  return (
    <UpcomingPage
      eyebrow="Library"
      title="Artists"
      icon={<MicVocal className="size-6" />}
      heading="Artists, coming in Stage 3"
    >
      Every artist, with their albums and most played songs.
    </UpcomingPage>
  );
}
