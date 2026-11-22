'use client';

import type { ReactNode } from 'react';

import { Artwork } from '@/components/player/Artwork';
import BlurText from '@/components/reactbits/BlurText';
import { Tilt } from '@/components/ui/Tilt';
import { cn } from '@/lib/cn';
import { useSettings } from '@/lib/stores/settings';

interface CollectionHeroProps {
  eyebrow: string;
  title: string;
  artworkHash: string | null;
  round?: boolean;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}

const TITLE_CLASS = 'font-display text-5xl leading-[1.05] tracking-tight text-fg lg:text-6xl';

/**
 * Header for an album or artist. A blurred, oversized copy of the
 * cover sits behind it, so every album tints its own page.
 */
export function CollectionHero({ eyebrow, title, artworkHash, round, subtitle, meta, actions }: CollectionHeroProps) {
  const fullMotion = useSettings((state) => state.motion === 'full');

  return (
    <header className="relative isolate">
      {artworkHash && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-24 -top-40 -bottom-16 -z-10 overflow-hidden opacity-45 [mask-image:radial-gradient(70%_70%_at_30%_40%,black,transparent)]"
        >
          <Artwork hash={artworkHash} size="thumb" className="size-full scale-125 blur-3xl saturate-150" />
        </div>
      )}

      <div className="flex flex-wrap items-end gap-8">
        <Tilt className={cn('size-52 shrink-0 overflow-hidden shadow-float lg:size-60', round ? 'rounded-full' : 'rounded-2xl')}>
          <Artwork hash={artworkHash} size="full" alt="" className="size-full" />
        </Tilt>

        <div className="flex min-w-0 flex-1 flex-col gap-3 pb-1">
          <span className="text-xs font-medium tracking-[0.18em] text-fg-subtle uppercase">{eyebrow}</span>
          {fullMotion ? (
            <BlurText as="h1" text={title} trigger="load" delay={60} stepDuration={0.32} blur={8} distance={14} className={TITLE_CLASS} />
          ) : (
            <h1 className={TITLE_CLASS}>{title}</h1>
          )}
          {subtitle && <div className="text-base text-fg">{subtitle}</div>}
          {meta && <div className="text-sm text-fg-muted">{meta}</div>}
          {actions && <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </div>
    </header>
  );
}
