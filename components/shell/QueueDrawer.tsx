'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ListMusic, X } from 'lucide-react';

import { IconButton } from '@/components/ui/Button';
import { useUi } from '@/lib/stores/ui';

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
          className="absolute inset-y-0 right-0 z-20 flex w-[340px] flex-col border-l border-border bg-surface/85 shadow-float backdrop-blur-2xl"
        >
          <header className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="font-display text-2xl">Up next</h2>
            <IconButton label="Close queue" size="sm" onClick={() => setOpen(false)}>
              <X className="size-4" />
            </IconButton>
          </header>

          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
            <ListMusic className="size-8 text-fg-subtle" />
            <p className="text-sm text-fg-muted">
              Your queue is empty. Songs you play or add will line up here.
            </p>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
