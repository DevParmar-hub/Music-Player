'use client';

import { DropdownMenu } from 'radix-ui';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Check, ChevronDown } from 'lucide-react';

import { IconButton } from './Button';

interface SortMenuProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Omit to hide the direction toggle. */
  direction?: 'asc' | 'desc';
  onDirectionChange?: (direction: 'asc' | 'desc') => void;
}

/** "Sort: Title ▾" with an optional ascending/descending toggle. */
export function SortMenu<T extends string>({
  options,
  value,
  onChange,
  direction,
  onDirectionChange,
}: SortMenuProps<T>) {
  const current = options.find((option) => option.value === value);

  return (
    <div className="flex items-center gap-1">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface-2/60 px-3.5 text-sm text-fg-muted transition-colors outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:text-fg">
          Sort: <span className="text-fg">{current?.label}</span>
          <ChevronDown className="size-3.5" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="z-50 min-w-[180px] origin-[var(--radix-dropdown-menu-content-transform-origin)] animate-[menu-in_120ms_ease-out] rounded-xl border border-border bg-surface/95 p-1 text-sm text-fg shadow-float backdrop-blur-xl"
          >
            <DropdownMenu.RadioGroup value={value} onValueChange={(next) => onChange(next as T)}>
              {options.map((option) => (
                <DropdownMenu.RadioItem
                  key={option.value}
                  value={option.value}
                  className="flex h-8 cursor-default items-center gap-2.5 rounded-lg px-2.5 outline-none select-none data-[highlighted]:bg-surface-2"
                >
                  <span className="flex size-4 items-center justify-center">
                    <DropdownMenu.ItemIndicator>
                      <Check className="size-4 text-accent-text" />
                    </DropdownMenu.ItemIndicator>
                  </span>
                  {option.label}
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {direction && onDirectionChange && (
        <IconButton
          label={direction === 'asc' ? 'Ascending' : 'Descending'}
          size="sm"
          onClick={() => onDirectionChange(direction === 'asc' ? 'desc' : 'asc')}
        >
          {direction === 'asc' ? <ArrowUpNarrowWide className="size-4" /> : <ArrowDownWideNarrow className="size-4" />}
        </IconButton>
      )}
    </div>
  );
}

/** Rounded filter field used above lists and grids. */
export function FilterInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="h-9 w-64 rounded-full border border-border bg-surface-2/60 px-4 text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-accent"
    />
  );
}
