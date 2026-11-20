'use client';

import type { ReactNode } from 'react';

import { EmptyState } from './EmptyState';
import { Page, PageHeader } from './PageHeader';

/** Placeholder for views whose stage has not been built yet. */
export function UpcomingPage({
  eyebrow,
  title,
  icon,
  heading,
  children,
}: {
  eyebrow: string;
  title: string;
  icon: ReactNode;
  heading: string;
  children: ReactNode;
}) {
  return (
    <Page>
      <PageHeader eyebrow={eyebrow} title={title} />
      <EmptyState icon={icon} title={heading}>
        {children}
      </EmptyState>
    </Page>
  );
}
