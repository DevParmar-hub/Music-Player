import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, children, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border px-8 py-16 text-center',
        className,
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-accent-text">
        {icon}
      </div>
      <div className="flex max-w-sm flex-col gap-1.5">
        <h2 className="text-lg font-medium text-fg">{title}</h2>
        {children && <div className="text-sm leading-relaxed text-fg-muted">{children}</div>}
      </div>
      {action}
    </div>
  );
}
