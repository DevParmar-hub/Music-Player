'use client';

import { useRef, type PointerEvent, type ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { useSettings } from '@/lib/stores/settings';

/**
 * Leans its content toward the pointer, with a soft glare that follows
 * it. Only CSS variables change on move, so React never re-renders.
 * Full motion only.
 */
export function Tilt({
  children,
  className,
  maxDegrees = 7,
}: {
  children: ReactNode;
  className?: string;
  maxDegrees?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const enabled = useSettings((state) => state.motion === 'full');

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const element = ref.current;
    if (!element || !enabled || event.pointerType !== 'mouse') return;
    const rect = element.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    element.style.setProperty('--tilt-x', `${(0.5 - y) * maxDegrees}deg`);
    element.style.setProperty('--tilt-y', `${(x - 0.5) * maxDegrees}deg`);
    element.style.setProperty('--glare-x', `${x * 100}%`);
    element.style.setProperty('--glare-y', `${y * 100}%`);
  };

  const onPointerLeave = () => {
    ref.current?.style.setProperty('--tilt-x', '0deg');
    ref.current?.style.setProperty('--tilt-y', '0deg');
  };

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className={cn(
        'group/tilt relative transition-transform duration-300 ease-out will-change-transform',
        className,
      )}
      style={{
        transform: 'perspective(700px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))',
      }}
    >
      {children}
      {enabled && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 mix-blend-overlay transition-opacity duration-300 group-hover/tilt:opacity-100"
          style={{
            background:
              'radial-gradient(circle at var(--glare-x, 50%) var(--glare-y, 50%), rgb(255 255 255 / 0.35), transparent 55%)',
          }}
        />
      )}
    </div>
  );
}
