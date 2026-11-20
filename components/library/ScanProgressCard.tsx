'use client';

import { motion } from 'motion/react';
import { LoaderCircle } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { scanFraction, useScan } from '@/lib/stores/scan';

/** Live progress of a running scan, with a way to stop it. */
export function ScanProgressCard() {
  const progress = useScan((state) => state.progress);
  const cancel = useScan((state) => state.cancel);
  const fraction = scanFraction(progress);

  const folderNote =
    progress && progress.rootCount > 1 ? ` · folder ${progress.rootIndex} of ${progress.rootCount}` : '';

  return (
    <section
      role="status"
      aria-live="polite"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-surface/70 p-5"
    >
      <div className="flex items-center gap-3">
        <LoaderCircle className="size-5 animate-spin text-accent-text" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-medium text-fg">
            {progress?.phase === 'discovering' ? 'Looking for music…' : 'Reading your music'}
            {folderNote}
          </span>
          <span className="text-xs text-fg-muted tabular-nums">
            {progress && progress.total > 0
              ? `${progress.processed.toLocaleString()} of ${progress.total.toLocaleString()} files · ${progress.inserted.toLocaleString()} new`
              : 'Counting files'}
          </span>
        </div>
        <Button size="sm" variant="ghost" onClick={cancel}>
          Stop
        </Button>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-300"
          initial={false}
          animate={{ width: `${(fraction ?? 0.03) * 100}%` }}
          transition={{ ease: 'easeOut', duration: 0.3 }}
        />
      </div>

      {progress?.currentFile && (
        <p className="truncate font-mono text-[11px] text-fg-subtle">{progress.currentFile}</p>
      )}
    </section>
  );
}
