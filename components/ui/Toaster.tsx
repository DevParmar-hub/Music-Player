'use client';

import { AnimatePresence, motion } from 'motion/react';
import { CircleAlert, X } from 'lucide-react';

import { cn } from '@/lib/cn';
import { useToasts } from '@/lib/stores/toast';

/** Toast stack floating just above the player bar. */
export function Toaster() {
  const toasts = useToasts((state) => state.toasts);
  const dismiss = useToasts((state) => state.dismiss);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[100px] z-40 flex flex-col items-center gap-2 px-4"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex max-w-md items-center gap-3 rounded-full border border-border bg-surface/90 py-2 pr-2 pl-4 text-sm text-fg shadow-float backdrop-blur-xl"
          >
            {toast.tone === 'error' && <CircleAlert className="size-4 shrink-0 text-love-text" />}
            <span className="min-w-0 flex-1">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.run();
                  dismiss(toast.id);
                }}
                className="rounded-full px-2.5 py-1 font-medium text-accent-text hover:bg-accent-soft"
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(toast.id)}
              className={cn('rounded-full p-1.5 text-fg-subtle hover:bg-surface-2 hover:text-fg')}
            >
              <X className="size-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
