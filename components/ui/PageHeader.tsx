'use client';

import type { ReactNode } from 'react';

import BlurText from '@/components/reactbits/BlurText';
import { useSettings } from '@/lib/stores/settings';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

const TITLE_CLASS = 'font-display text-5xl leading-[1.05] tracking-tight text-fg';

/** Page title in the display serif. It blurs in only at full motion. */
export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  const fullMotion = useSettings((state) => state.motion === 'full');

  return (
    <header className="flex flex-wrap items-end justify-between gap-6">
      <div className="flex min-w-0 flex-col gap-2">
        {eyebrow && (
          <span className="text-xs font-medium tracking-[0.18em] text-fg-subtle uppercase">
            {eyebrow}
          </span>
        )}
        {fullMotion ? (
          <BlurText
            as="h1"
            text={title}
            trigger="load"
            delay={70}
            stepDuration={0.32}
            blur={8}
            distance={14}
            className={TITLE_CLASS}
          />
        ) : (
          <h1 className={TITLE_CLASS}>{title}</h1>
        )}
        {description && <div className="max-w-xl text-sm text-fg-muted">{description}</div>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Standard page padding and width. */
export function Page({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-10 pt-12 pb-16">
      {children}
    </div>
  );
}
