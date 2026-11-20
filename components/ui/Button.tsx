import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover shadow-[0_6px_20px_-8px_var(--accent)]',
  secondary: 'bg-surface-2 text-fg hover:bg-surface-3 border border-border',
  ghost: 'text-fg-muted hover:text-fg hover:bg-surface-2',
  danger: 'text-love-text hover:bg-love-soft',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-medium',
        'transition-[background-color,color,transform] duration-150 active:scale-[0.97]',
        'disabled:pointer-events-none disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

type IconButtonSize = 'sm' | 'md' | 'lg';

const ICON_SIZES: Record<IconButtonSize, string> = {
  sm: 'size-8',
  md: 'size-9',
  lg: 'size-11',
};

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only buttons need an accessible name. */
  label: string;
  size?: IconButtonSize;
  variant?: 'ghost' | 'primary';
  active?: boolean;
}

export function IconButton({
  label,
  size = 'md',
  variant = 'ghost',
  active = false,
  className,
  children,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        'transition-[background-color,color,transform] duration-150 active:scale-[0.92]',
        'disabled:pointer-events-none disabled:opacity-35',
        variant === 'primary'
          ? 'bg-accent text-accent-fg hover:bg-accent-hover'
          : active
            ? 'text-accent-text bg-accent-soft'
            : 'text-fg-muted hover:text-fg hover:bg-surface-2',
        ICON_SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
