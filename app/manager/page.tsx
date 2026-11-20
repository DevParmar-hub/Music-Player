'use client';

import { FolderCog } from 'lucide-react';

import { UpcomingPage } from '@/components/ui/UpcomingPage';

export default function ManagerPage() {
  return (
    <UpcomingPage
      eyebrow="Manage"
      title="Library manager"
      icon={<FolderCog className="size-6" />}
      heading="The manager, coming in Stage 6"
    >
      Edit tags, find duplicates, relink missing files and tidy your folders, with undo for everything.
    </UpcomingPage>
  );
}
