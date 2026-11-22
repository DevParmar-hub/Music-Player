'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, Reorder } from 'motion/react';
import { GripVertical, ListMusic, X } from 'lucide-react';

import { Artwork } from '@/components/player/Artwork';
import { PlayingBars } from '@/components/player/PlayingBars';
import { Button, IconButton } from '@/components/ui/Button';
import { formatTime } from '@/lib/format';
import { usePlayer, type QueueItem } from '@/lib/player/store';
import { useUi } from '@/lib/stores/ui';

/** Rows rendered after the current song; the rest are summarized. */
const VISIBLE_UPCOMING = 100;

/**
 * "Up next" drawer. It slides over the page (transform only, so the
 * page never re-lays out while it animates).
 */
export function QueueDrawer() {
  const open = useUi((state) => state.queueOpen);
  const setOpen = useUi((state) => state.setQueueOpen);

  useEffect(() => {
    if (!open) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open, setOpen]);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          aria-label="Queue"
          initial={{ x: '100%', opacity: 0.6 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0.6 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
          className="absolute inset-y-0 right-0 z-20 flex w-[360px] flex-col border-l border-border bg-surface/85 shadow-float backdrop-blur-2xl"
        >
          <header className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="font-display text-2xl">Up next</h2>
            <IconButton label="Close queue" size="sm" onClick={() => setOpen(false)}>
              <X className="size-4" />
            </IconButton>
          </header>
          <QueueContents />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function QueueContents() {
  const queue = usePlayer((state) => state.queue);
  const index = usePlayer((state) => state.index);
  const source = usePlayer((state) => state.source);
  const playing = usePlayer((state) => state.playing);
  const clearUpcoming = usePlayer((state) => state.clearUpcoming);

  const current = queue[index];
  const upcomingCount = Math.max(0, queue.length - index - 1);

  if (!current) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
        <ListMusic className="size-8 text-fg-subtle" />
        <p className="text-sm text-fg-muted">
          Your queue is empty. Songs you play or add will line up here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <section aria-label="Now playing" className="px-5 pb-4">
        <p className="mb-2 text-xs tracking-wide text-fg-subtle uppercase">
          Now playing{source && <span className="normal-case"> · {source}</span>}
        </p>
        <div className="flex items-center gap-3 rounded-2xl bg-love-soft p-2.5">
          <Artwork hash={current.track.artworkHash} className="size-12 shrink-0 rounded-lg" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-fg">{current.track.title}</span>
            <span className="truncate text-xs text-fg-muted">
              {current.track.artistName ?? 'Unknown artist'}
            </span>
          </div>
          <PlayingBars playing={playing} className="mr-1.5" />
        </div>
      </section>

      <div className="flex items-center justify-between px-5 pb-2">
        <p className="text-xs tracking-wide text-fg-subtle uppercase">
          Next · {upcomingCount.toLocaleString()} song{upcomingCount === 1 ? '' : 's'}
        </p>
        {upcomingCount > 0 && (
          <Button size="sm" variant="ghost" onClick={clearUpcoming} className="-mr-2 h-7">
            Clear
          </Button>
        )}
      </div>

      <UpcomingList queue={queue} index={index} />
    </div>
  );
}

function UpcomingList({ queue, index }: { queue: QueueItem[]; index: number }) {
  const jumpTo = usePlayer((state) => state.jumpTo);
  const removeAt = usePlayer((state) => state.removeAt);
  const reorderUpcoming = usePlayer((state) => state.reorderUpcoming);

  const visible = queue.slice(index + 1, index + 1 + VISIBLE_UPCOMING);
  const hidden = queue.length - index - 1 - visible.length;

  // While dragging, reorder a local copy; commit once on drop so the
  // engine is not asked to preload a new song on every swap.
  const [draft, setDraft] = useState<QueueItem[] | null>(null);
  const draggedRecently = useRef(false);
  const items = draft ?? visible;

  const commit = () => {
    if (draft) reorderUpcoming(draft);
    setDraft(null);
    draggedRecently.current = true;
    window.setTimeout(() => (draggedRecently.current = false), 50);
  };

  if (visible.length === 0) {
    return <p className="px-5 text-sm text-fg-muted">Nothing after this song.</p>;
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
      <Reorder.Group axis="y" values={items} onReorder={setDraft} className="flex flex-col">
        {items.map((item, offset) => {
          const absoluteIndex = index + 1 + offset;
          return (
            <Reorder.Item
              key={item.key}
              value={item}
              onDragEnd={commit}
              className="group flex cursor-grab items-center gap-3 rounded-xl px-2 py-1.5 select-none hover:bg-surface-2 active:cursor-grabbing"
              whileDrag={{ scale: 1.02, boxShadow: 'var(--shadow-float)' }}
              onClick={() => {
                if (!draggedRecently.current) jumpTo(absoluteIndex);
              }}
            >
              <GripVertical className="size-3.5 shrink-0 text-fg-subtle opacity-0 group-hover:opacity-100" />
              <Artwork hash={item.track.artworkHash} className="size-9 shrink-0 rounded-md" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span
                  className={
                    item.track.available ? 'truncate text-sm text-fg' : 'truncate text-sm text-fg-subtle line-through'
                  }
                >
                  {item.track.title}
                </span>
                <span className="truncate text-xs text-fg-muted">
                  {item.track.artistName ?? 'Unknown artist'}
                </span>
              </div>
              <span className="text-xs text-fg-subtle tabular-nums group-hover:hidden">
                {formatTime(item.track.durationMs / 1000)}
              </span>
              <IconButton
                label={`Remove "${item.track.title}" from queue`}
                size="sm"
                className="hidden size-7 group-hover:inline-flex"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  removeAt(absoluteIndex);
                }}
              >
                <X className="size-3.5" />
              </IconButton>
            </Reorder.Item>
          );
        })}
      </Reorder.Group>
      {hidden > 0 && (
        <p className="px-2 pt-3 text-xs text-fg-subtle">
          …and {hidden.toLocaleString()} more
        </p>
      )}
    </div>
  );
}
