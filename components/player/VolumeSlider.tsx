'use client';

import { useRef, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { Volume1, Volume2, VolumeX } from 'lucide-react';

import { IconButton } from '@/components/ui/Button';
import { usePlayer } from '@/lib/player/store';

const WIDTH = 96;
const MAX_STRETCH = 10;
const STEP = 0.05;

/** Pulling past an end stretches the bar a little, with resistance. */
function resist(overflow: number): number {
  return MAX_STRETCH * (2 / (1 + Math.exp(-overflow / MAX_STRETCH)) - 1);
}

/**
 * Volume with an elastic feel (after React Bits' ElasticSlider): drag
 * beyond either end and the bar stretches, then springs back.
 */
export function VolumeSlider() {
  const volume = usePlayer((state) => state.volume);
  const muted = usePlayer((state) => state.muted);
  const setVolume = usePlayer((state) => state.setVolume);
  const toggleMute = usePlayer((state) => state.toggleMute);

  const barRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const stretch = useMotionValue(0);
  const scaleX = useTransform(stretch, (value) => 1 + Math.abs(value) / WIDTH);
  const originX = useTransform(stretch, (value) => (value < 0 ? 1 : 0));

  const shown = muted ? 0 : volume;

  const update = (clientX: number) => {
    const rect = barRef.current!.getBoundingClientRect();
    const raw = clientX - rect.left;
    setVolume(Math.min(1, Math.max(0, raw / rect.width)));
    stretch.set(raw < 0 ? -resist(-raw) : raw > rect.width ? resist(raw - rect.width) : 0);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = true;
    update(event.clientX);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) update(event.clientX);
  };

  const release = (event: PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    animate(stretch, 0, { type: 'spring', bounce: 0.5, duration: 0.5 });
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    setVolume(shown + (event.deltaY < 0 ? STEP : -STEP));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') setVolume(shown + STEP);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') setVolume(shown - STEP);
    else if (event.key === 'Home') setVolume(0);
    else if (event.key === 'End') setVolume(1);
    else return;
    event.preventDefault();
  };

  const Icon = shown === 0 ? VolumeX : shown < 0.5 ? Volume1 : Volume2;

  return (
    <div className="flex items-center gap-1.5">
      <IconButton label={muted ? 'Unmute' : 'Mute'} size="sm" onClick={toggleMute}>
        <Icon className="size-[18px]" />
      </IconButton>

      <div
        ref={barRef}
        role="slider"
        tabIndex={0}
        aria-label="Volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(shown * 100)}
        aria-valuetext={`${Math.round(shown * 100)}%`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        className="group flex h-6 cursor-pointer touch-none items-center"
        style={{ width: WIDTH }}
      >
        <motion.div
          className="relative h-1 w-full overflow-hidden rounded-full bg-surface-3 transition-[height] duration-150 group-hover:h-1.5"
          style={{ scaleX, originX }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-fg-muted transition-colors group-hover:bg-accent"
            style={{ width: `${shown * 100}%` }}
          />
        </motion.div>
      </div>
    </div>
  );
}
