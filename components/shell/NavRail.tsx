'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
  Disc3,
  FolderCog,
  House,
  ListMusic,
  MicVocal,
  Music2,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/cn';
import { scanFraction, useScan } from '@/lib/stores/scan';
import { useSettings } from '@/lib/stores/settings';
import { useUi } from '@/lib/stores/ui';
import { LogoMark } from './LogoMark';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Detail routes that should light up this item, e.g. /album. */
  alsoMatches?: string[];
}

const LIBRARY: NavItem[] = [
  { href: '/', label: 'Home', icon: House },
  { href: '/songs', label: 'Songs', icon: Music2 },
  { href: '/albums', label: 'Albums', icon: Disc3, alsoMatches: ['/album'] },
  { href: '/artists', label: 'Artists', icon: MicVocal, alsoMatches: ['/artist'] },
  { href: '/playlists', label: 'Playlists', icon: ListMusic, alsoMatches: ['/playlist'] },
];

const MANAGE: NavItem[] = [
  { href: '/manager', label: 'Manager', icon: FolderCog },
  { href: '/settings', label: 'Settings', icon: Settings, alsoMatches: ['/lab'] },
];

const EXPANDED_WIDTH = 228;
const COLLAPSED_WIDTH = 76;

function isActive(pathname: string, item: NavItem): boolean {
  const routes = [item.href, ...(item.alsoMatches ?? [])];
  return routes.some((route) =>
    route === '/' ? pathname === '/' : pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function NavRail() {
  const pathname = usePathname();
  const collapsed = useSettings((state) => state.railCollapsed);
  const update = useSettings((state) => state.update);

  return (
    <motion.nav
      aria-label="Main"
      initial={false}
      animate={{ width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
      transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
      className="flex shrink-0 flex-col gap-6 overflow-hidden border-r border-border bg-surface/60 px-3 py-5 backdrop-blur-xl"
    >
      <div className="flex h-9 items-center gap-3 px-2.5">
        <LogoMark className="size-7 shrink-0" />
        <Label collapsed={collapsed} className="font-display text-[1.35rem] leading-none">
          Music Player
        </Label>
      </div>

      <SearchButton collapsed={collapsed} />

      <NavGroup items={LIBRARY} pathname={pathname} collapsed={collapsed} />

      <div className="mt-auto flex flex-col gap-3">
        <ScanIndicator collapsed={collapsed} />
        <NavGroup items={MANAGE} pathname={pathname} collapsed={collapsed} />
        <button
          type="button"
          onClick={() => update('railCollapsed', !collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex h-9 items-center gap-3 rounded-xl px-3 text-fg-subtle transition-colors hover:text-fg"
        >
          {collapsed ? (
            <PanelLeftOpen className="size-[18px] shrink-0" />
          ) : (
            <PanelLeftClose className="size-[18px] shrink-0" />
          )}
          <Label collapsed={collapsed} className="text-sm">
            Collapse
          </Label>
        </button>
      </div>
    </motion.nav>
  );
}

function NavGroup({
  items,
  pathname,
  collapsed,
}: {
  items: NavItem[];
  pathname: string;
  collapsed: boolean;
}) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const active = isActive(pathname, item);
        const Icon = item.icon;

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? 'page' : undefined}
              title={collapsed ? item.label : undefined}
              className={cn(
                'relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors',
                active ? 'text-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
              )}
            >
              {active && (
                <motion.span
                  layoutId="rail-active"
                  className="absolute inset-0 rounded-xl bg-accent-soft"
                  transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                >
                  <span className="absolute top-1/2 left-0 h-4 w-[3px] -translate-y-1/2 rounded-full bg-accent" />
                </motion.span>
              )}
              <Icon
                className={cn('relative size-[18px] shrink-0', active && 'text-accent-text')}
                strokeWidth={active ? 2.2 : 1.8}
              />
              <Label collapsed={collapsed} className="relative">
                {item.label}
              </Label>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Opens the command palette; shows its shortcut when expanded. */
function SearchButton({ collapsed }: { collapsed: boolean }) {
  const openPalette = useUi((state) => state.setPaletteOpen);

  return (
    <button
      type="button"
      onClick={() => openPalette(true)}
      aria-label="Search (Ctrl+K)"
      title={collapsed ? 'Search (Ctrl+K)' : undefined}
      aria-keyshortcuts="Control+K"
      className="-mt-2 flex h-10 items-center gap-3 rounded-xl border border-border bg-surface-2/60 px-3 text-sm text-fg-subtle transition-colors hover:border-border-strong hover:text-fg"
    >
      <Search className="size-[18px] shrink-0" />
      <Label collapsed={collapsed} className="flex-1 text-left">
        Search
      </Label>
      <Label collapsed={collapsed}>
        <kbd className="rounded-md border border-border px-1.5 py-0.5 font-sans text-[10px]">Ctrl K</kbd>
      </Label>
    </button>
  );
}

/** Text that fades out when the rail collapses. */
function Label({
  collapsed,
  className,
  children,
}: {
  collapsed: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <motion.span
      initial={false}
      animate={{ opacity: collapsed ? 0 : 1 }}
      transition={{ duration: collapsed ? 0.1 : 0.25, delay: collapsed ? 0 : 0.1 }}
      className={cn('truncate whitespace-nowrap', className)}
      aria-hidden={collapsed}
    >
      {children}
    </motion.span>
  );
}

function ScanIndicator({ collapsed }: { collapsed: boolean }) {
  const running = useScan((state) => state.running);
  const progress = useScan((state) => state.progress);
  const fraction = scanFraction(progress);

  return (
    <AnimatePresence>
      {running && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          className="flex flex-col gap-2 px-3"
          role="status"
          aria-label="Scanning library"
        >
          {!collapsed && (
            <span className="truncate text-xs text-fg-muted">
              Scanning library
              {fraction !== null && ` · ${Math.round(fraction * 100)}%`}
            </span>
          )}
          <div className="h-1 overflow-hidden rounded-full bg-surface-3">
            <motion.div
              className="h-full rounded-full bg-accent"
              initial={false}
              animate={{ width: `${(fraction ?? 0.05) * 100}%` }}
              transition={{ ease: 'easeOut', duration: 0.3 }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
