'use client';

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

import { cn } from '@/lib/cn';
import { formatTime, spokenTime } from '@/lib/format';
import { usePlaybackPosition } from '@/lib/player/position';
import { usePlayer } from '@/lib/player/store';

const KEY_STEP_SECONDS = 5;
const PAGE_STEP_SECONDS = 30;

/**
 * Song progress. Dragging previews the position and seeks once on
 * release, so audio never stutters mid-drag. The fill glows teal to
 * pink while playing.
 */
export function SeekBar() {
  const duration = usePlayer((state) => state.duration);
  const playing = usePlayer((state) => state.playing);
  const hasTrack = usePlayer((state) => state.queue[state.index] !== undefined);
  const seek = usePlayer((state) => state.seek);
  const position = usePlaybackPosition();

  const barRef = useRef<HTMLDivElement>(null);
  const [scrubbing, setScrubbing] = useState<number | null>(null);
  const [hover, setHover] = useState<{ x: number; time: number } | null>(null);

  const timeAt = (clientX: number) => {
    const rect = barRef.current!.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return { x: clientX - rect.left, time: fraction * duration };
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!hasTrack || !duration || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setScrubbing(timeAt(event.clientX).time);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!duration) return;
    const point = timeAt(event.clientX);
    setHover(point);
    if (scrubbing !== null) setScrubbing(point.time);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (scrubbing === null) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    seek(scrubbing);
    setScrubbing(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = {
      ArrowRight: KEY_STEP_SECONDS,
      ArrowUp: KEY_STEP_SECONDS,
      ArrowLeft: -KEY_STEP_SECONDS,
      ArrowDown: -KEY_STEP_SECONDS,
      PageUp: PAGE_STEP_SECONDS,
      PageDown: -PAGE_STEP_SECONDS,
    };
    if (event.key in steps) seek(position + steps[event.key]);
    else if (event.key === 'Home') seek(0);
    else if (event.key === 'End') seek(Math.max(0, duration - 1));
    else return;
    event.preventDefault();
  };

  const shown = scrubbing ?? position;
  const percent = duration ? Math.min(100, (shown / duration) * 100) : 0;
  const active = scrubbing !== null;

  return (
    <div className="flex w-full items-center gap-3 text-[11px] text-fg-subtle tabular-nums">
      <span className="w-10 text-right">{formatTime(shown)}</span>

      <div
        ref={barRef}
        role="slider"
        tabIndex={hasTrack ? 0 : -1}
        aria-label="Seek"
        aria-disabled={!hasTrack}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(shown)}
        aria-valuetext={`${spokenTime(shown)} of ${spokenTime(duration)}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setScrubbing(null)}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKeyDown}
        className={cn(
          'group relative flex h-4 flex-1 touch-none items-center rounded-full',
          hasTrack ? 'cursor-pointer' : 'pointer-events-none',
        )}
      >
        <div
          className={cn(
            'relative h-1 w-full overflow-hidden rounded-full bg-surface-3 transition-[height] duration-150 group-hover:h-1.5',
            active && 'h-1.5',
          )}
        >
          {/* Solid teal when paused... */}
          <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${percent}%` }} />
          {/* ...a full-width gradient revealed up to the playhead while playing. */}
          <div
            className={cn(
              'absolute inset-0 bg-gradient-to-r from-teal-500 to-pink-400 transition-opacity duration-500',
              playing ? 'opacity-100' : 'opacity-0',
            )}
            style={{ clipPath: `inset(0 ${100 - percent}% 0 0)` }}
          />
        </div>

        <span
          className={cn(
            'pointer-events-none absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg shadow-float transition-transform duration-150',
            active ? 'scale-100' : 'scale-0 group-hover:scale-100',
          )}
          style={{ left: `${percent}%` }}
        />

        {hover && duration > 0 && (
          <span
            className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded-md bg-surface-3 px-1.5 py-0.5 text-[11px] text-fg shadow-float"
            style={{ left: hover.x }}
          >
            {formatTime(hover.time)}
          </span>
        )}
      </div>

      <span className="w-10">{formatTime(duration)}</span>
    </div>
  );
}
