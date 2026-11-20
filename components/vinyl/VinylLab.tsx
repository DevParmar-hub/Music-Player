'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type gsap from 'gsap';
import { FastForward, Play, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { useResolvedTheme } from '@/lib/hooks/useResolvedTheme';
import { getAlbums } from '@/lib/tauri/api';
import { artworkUrl, loadArtworkDirectory } from '@/lib/tauri/assets';
import { VinylScene } from './VinylScene';

const AUTOPLAY_DELAY_MS = 500;

/**
 * Stage 1 lab for the Vinyl intro: play, skip and scrub the timeline
 * to judge timing and camera moves before the real models exist.
 */
export default function VinylLab() {
  const theme = useResolvedTheme();
  const [timeline, setTimeline] = useState<gsap.core.Timeline | null>(null);
  const [labelUrl, setLabelUrl] = useState<string | null>(null);
  const scrubRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);

  const handleTimeline = useCallback((built: gsap.core.Timeline) => setTimeline(built), []);

  // Put a real cover on the label when the library has one.
  useEffect(() => {
    let cancelled = false;

    Promise.all([getAlbums(), loadArtworkDirectory()])
      .then(([albums, directory]) => {
        const album = albums.find((candidate) => candidate.artworkHash);
        if (!cancelled && album?.artworkHash) {
          setLabelUrl(artworkUrl(directory, album.artworkHash, 'full'));
        }
      })
      .catch(() => {
        // No backend or no art: the gradient label stays.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Mirror the playhead into the scrubber without re-rendering React.
  useEffect(() => {
    if (!timeline) return;

    timeline.eventCallback('onUpdate', () => {
      if (scrubRef.current) scrubRef.current.value = String(timeline.time());
      if (timeRef.current) timeRef.current.textContent = `${timeline.time().toFixed(2)}s`;
    });

    const autoplay = window.setTimeout(() => timeline.play(0), AUTOPLAY_DELAY_MS);

    return () => {
      window.clearTimeout(autoplay);
      timeline.eventCallback('onUpdate', null);
    };
  }, [timeline]);

  const skip = () => timeline?.progress(1).pause();

  return (
    <div className="relative h-[calc(100dvh-84px)] min-h-[520px]">
      {/* Clicking the scene skips the intro, as it will in Now Playing. */}
      <div className="absolute inset-0" onClick={skip}>
        <VinylScene theme={theme} labelUrl={labelUrl} onTimeline={handleTimeline} />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-8">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium tracking-[0.18em] text-fg-subtle uppercase">Lab</span>
          <h1 className="font-display text-4xl text-fg">Record player test</h1>
          <p className="max-w-sm text-sm text-fg-muted">
            Rough shapes to judge the intro&apos;s timing and camera. Real materials and detail
            come in Stage 5. Click the scene to skip.
          </p>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex justify-center p-6">
        <div className="flex w-full max-w-2xl items-center gap-3 rounded-full border border-border bg-surface/80 px-3 py-2 shadow-float backdrop-blur-xl">
          <Button size="sm" variant="primary" icon={<Play className="size-3.5 fill-current" />} onClick={() => timeline?.play(0)}>
            Play intro
          </Button>
          <Button size="sm" variant="ghost" icon={<FastForward className="size-3.5" />} onClick={skip}>
            Skip
          </Button>
          <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => timeline?.pause(0)}>
            Reset
          </Button>
          <input
            ref={scrubRef}
            type="range"
            aria-label="Scrub intro"
            min={0}
            max={timeline?.duration() ?? 1}
            step={0.01}
            defaultValue={0}
            onChange={(event) => timeline?.pause(Number(event.target.value))}
            className="flex-1 accent-[var(--accent)]"
          />
          <span ref={timeRef} className="w-12 text-right font-mono text-xs text-fg-muted tabular-nums">
            0.00s
          </span>
        </div>
      </div>
    </div>
  );
}
