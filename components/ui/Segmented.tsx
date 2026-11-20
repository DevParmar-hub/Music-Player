'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface Option<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface SegmentedProps<T extends string> {
  /** Unique per instance; drives the sliding pill animation. */
  id: string;
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** A radio group drawn as a pill switch with a sliding highlight. */
export function Segmented<T extends string>({
  id,
  label,
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-full border border-border bg-surface-2 p-1"
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative flex h-8 items-center gap-1.5 rounded-full px-3.5 text-sm transition-colors',
              selected ? 'text-fg' : 'text-fg-muted hover:text-fg',
            )}
          >
            {selected && (
              <motion.span
                layoutId={`${id}-pill`}
                className="absolute inset-0 rounded-full bg-surface shadow-float"
                transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {option.icon}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
