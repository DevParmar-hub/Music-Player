'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ask } from '@tauri-apps/plugin-dialog';
import {
  ArrowUpRight,
  Folder,
  FolderPlus,
  Monitor,
  Moon,
  RefreshCw,
  Sun,
  Trash2,
} from 'lucide-react';

import { ScanProgressCard } from '@/components/library/ScanProgressCard';
import { Button, IconButton } from '@/components/ui/Button';
import { Page, PageHeader } from '@/components/ui/PageHeader';
import { Segmented } from '@/components/ui/Segmented';
import { cn } from '@/lib/cn';
import { useScan } from '@/lib/stores/scan';
import { useSettings, type CrossfadeSeconds, type NowPlayingMode } from '@/lib/stores/settings';
import type { LibraryRoot, ScanProgress } from '@/lib/tauri/types';

export default function SettingsPage() {
  return (
    <Page>
      <PageHeader eyebrow="Settings" title="Make it yours" />
      <AppearanceSection />
      <PlaybackSection />
      <LibrarySection />
      <LabsSection />
    </Page>
  );
}

// ============================================================
// Appearance
// ============================================================

const MOTION_DESCRIPTIONS = {
  full: 'Every animation, including the cinematic record player.',
  calm: 'Gentle fades only. The record player skips its intro.',
  off: 'No movement at all.',
} as const;

function AppearanceSection() {
  const theme = useSettings((state) => state.theme);
  const motion = useSettings((state) => state.motion);
  const nowPlayingMode = useSettings((state) => state.nowPlayingMode);
  const update = useSettings((state) => state.update);

  return (
    <Section title="Appearance">
      <Row label="Theme" hint="System follows your Windows setting.">
        <Segmented
          id="theme"
          label="Theme"
          value={theme}
          onChange={(value) => update('theme', value)}
          options={[
            { value: 'system', label: 'System', icon: <Monitor className="size-3.5" /> },
            { value: 'dark', label: 'Dark', icon: <Moon className="size-3.5" /> },
            { value: 'light', label: 'Light', icon: <Sun className="size-3.5" /> },
          ]}
        />
      </Row>

      <Row label="Now Playing style" hint="You can also switch from the Now Playing screen.">
        <div role="radiogroup" aria-label="Now Playing style" className="grid grid-cols-2 gap-3">
          <ModeCard
            mode="vinyl"
            selected={nowPlayingMode === 'vinyl'}
            onSelect={() => update('nowPlayingMode', 'vinyl')}
            title="Vinyl"
            description="A record player opens and plays your song."
            preview={<VinylPreview />}
          />
          <ModeCard
            mode="studio"
            selected={nowPlayingMode === 'studio'}
            onSelect={() => update('nowPlayingMode', 'studio')}
            title="Studio"
            description="Calm and artwork-first."
            preview={<StudioPreview />}
          />
        </div>
      </Row>

      <Row label="Motion" hint={MOTION_DESCRIPTIONS[motion]}>
        <Segmented
          id="motion"
          label="Motion"
          value={motion}
          onChange={(value) => update('motion', value)}
          options={[
            { value: 'full', label: 'Full' },
            { value: 'calm', label: 'Calm' },
            { value: 'off', label: 'Off' },
          ]}
        />
      </Row>
    </Section>
  );
}

function ModeCard({
  selected,
  onSelect,
  title,
  description,
  preview,
}: {
  mode: NowPlayingMode;
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  preview: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex w-56 flex-col gap-3 rounded-2xl border p-3 text-left transition-[border-color,background-color]',
        selected
          ? 'border-accent bg-accent-soft'
          : 'border-border bg-surface-2/60 hover:border-border-strong',
      )}
    >
      <div className="flex h-24 items-center justify-center overflow-hidden rounded-xl bg-bg">
        {preview}
      </div>
      <div className="flex flex-col gap-0.5 px-1">
        <span className="text-sm font-medium text-fg">{title}</span>
        <span className="text-xs text-fg-muted">{description}</span>
      </div>
    </button>
  );
}

function VinylPreview() {
  return (
    <div className="relative size-16 rounded-full bg-ink-950 shadow-float ring-1 ring-white/10">
      <div className="absolute inset-2 rounded-full border border-white/10" />
      <div className="absolute inset-4 rounded-full border border-white/10" />
      <div className="absolute inset-[22px] rounded-full bg-gradient-to-br from-teal-400 to-pink-500" />
    </div>
  );
}

function StudioPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-3 rounded-2xl bg-gradient-to-br from-teal-500/40 to-pink-500/30 blur-xl" />
      <div className="relative size-14 rounded-lg bg-gradient-to-br from-teal-600 to-pink-600 shadow-float" />
    </div>
  );
}

// ============================================================
// Playback
// ============================================================

const SHORTCUTS: [string, string][] = [
  ['Space', 'Play or pause'],
  ['Ctrl + → / ←', 'Next or previous song'],
  ['Shift + → / ←', 'Skip ahead or back 10 seconds'],
  ['Ctrl + ↑ / ↓', 'Volume up or down'],
  ['M', 'Mute'],
];

function PlaybackSection() {
  const crossfade = useSettings((state) => state.crossfade);
  const update = useSettings((state) => state.update);

  return (
    <Section title="Playback">
      <Row
        label="Crossfade"
        hint={
          crossfade === 0
            ? 'Songs follow each other without a gap.'
            : `Each song fades into the next over ${crossfade} seconds.`
        }
      >
        <Segmented
          id="crossfade"
          label="Crossfade"
          value={String(crossfade)}
          onChange={(value) => update('crossfade', Number(value) as CrossfadeSeconds)}
          options={[
            { value: '0', label: 'Off' },
            { value: '3', label: '3s' },
            { value: '6', label: '6s' },
            { value: '9', label: '9s' },
          ]}
        />
      </Row>

      <Row label="Keyboard shortcuts" hint="Work anywhere except while typing.">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {SHORTCUTS.map(([keys, action]) => (
            <div key={keys} className="contents">
              <dt>
                <kbd className="rounded-md border border-border bg-surface-2 px-1.5 py-0.5 font-sans text-xs text-fg">
                  {keys}
                </kbd>
              </dt>
              <dd className="text-fg-muted">{action}</dd>
            </div>
          ))}
        </dl>
      </Row>
    </Section>
  );
}

// ============================================================
// Library
// ============================================================

function LibrarySection() {
  const roots = useScan((state) => state.roots);
  const running = useScan((state) => state.running);
  const progress = useScan((state) => state.progress);
  const error = useScan((state) => state.error);
  const addFolder = useScan((state) => state.addFolder);
  const rescan = useScan((state) => state.rescan);

  const lastScan = !running && progress ? progress : null;

  return (
    <Section
      title="Library"
      actions={
        <>
          <Button
            size="sm"
            icon={<RefreshCw className="size-3.5" />}
            onClick={rescan}
            disabled={running || roots.length === 0}
          >
            Rescan
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={<FolderPlus className="size-3.5" />}
            onClick={addFolder}
          >
            Add folder
          </Button>
        </>
      }
    >
      {error && (
        <p role="alert" className="rounded-xl bg-love-soft px-4 py-3 text-sm text-love-text">
          {error}
        </p>
      )}

      {running && <ScanProgressCard />}

      {roots.length === 0 ? (
        <p className="text-sm text-fg-muted">No music folders yet. Add one to build your library.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border">
          {roots.map((root) => (
            <FolderRow key={root.id} root={root} disabled={running} />
          ))}
        </ul>
      )}

      {lastScan && <LastScanSummary progress={lastScan} />}
    </Section>
  );
}

function FolderRow({ root, disabled }: { root: LibraryRoot; disabled: boolean }) {
  const removeFolder = useScan((state) => state.removeFolder);

  async function confirmRemove() {
    const confirmed = await ask(
      `Remove "${root.path}" from your library?\n\nIts ${root.trackCount} songs leave the library and any playlists. The files on disk are not touched.`,
      { title: 'Remove folder', kind: 'warning', okLabel: 'Remove', cancelLabel: 'Keep' },
    );

    if (confirmed) await removeFolder(root.id);
  }

  return (
    <li className="flex items-center gap-4 px-4 py-3">
      <Folder className="size-[18px] shrink-0 text-accent-text" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm text-fg">{root.path}</span>
        <span className="text-xs text-fg-muted">{root.trackCount.toLocaleString()} songs</span>
      </div>
      <IconButton
        label={disabled ? 'Wait for the scan to finish' : 'Remove folder'}
        size="sm"
        onClick={confirmRemove}
        disabled={disabled}
      >
        <Trash2 className="size-4" />
      </IconButton>
    </li>
  );
}

function LastScanSummary({ progress }: { progress: ScanProgress }) {
  const headline =
    progress.phase === 'failed'
      ? `Last scan failed: ${progress.message ?? 'unknown error'}`
      : progress.phase === 'cancelled'
        ? 'Last scan was stopped early.'
        : 'Last scan finished.';

  return (
    <div className="flex flex-col gap-2 text-sm text-fg-muted">
      <p>
        {headline} {progress.inserted.toLocaleString()} new, {progress.updated.toLocaleString()}{' '}
        updated, {progress.unavailable.toLocaleString()} now missing
        {progress.failed > 0 && `, ${progress.failed.toLocaleString()} could not be read`}.
      </p>
      {progress.errors.length > 0 && (
        <details className="rounded-xl bg-surface-2/60 px-4 py-3">
          <summary className="cursor-pointer text-fg">
            {progress.errors.length} problem{progress.errors.length === 1 ? '' : 's'}
          </summary>
          <ul className="mt-2 flex flex-col gap-1 font-mono text-xs">
            {progress.errors.map((message) => (
              <li key={message} className="break-all">
                {message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// ============================================================
// Labs
// ============================================================

function LabsSection() {
  return (
    <Section title="Labs" hint="Work-in-progress experiments.">
      <div className="flex flex-wrap gap-3">
        <LabLink href="/lab/vinyl" title="Record player test" detail="First look at the 3D Vinyl intro" />
        <LabLink href="/lab/check" title="Backend check" detail="Raw library, playback and playlists" />
      </div>
    </Section>
  );
}

function LabLink({ href, title, detail }: { href: string; title: string; detail: string }) {
  return (
    <Link
      href={href}
      className="group flex w-64 items-start justify-between gap-3 rounded-2xl border border-border bg-surface-2/60 p-4 transition-colors hover:border-border-strong"
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-fg">{title}</span>
        <span className="text-xs text-fg-muted">{detail}</span>
      </span>
      <ArrowUpRight className="size-4 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </Link>
  );
}

// ============================================================
// Layout helpers
// ============================================================

function Section({
  title,
  hint,
  actions,
  children,
}: {
  title: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5 rounded-3xl border border-border bg-surface/50 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-display text-3xl text-fg">{title}</h2>
          {hint && <p className="text-sm text-fg-muted">{hint}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
      <div className="flex max-w-xs flex-col gap-0.5">
        <span className="text-sm font-medium text-fg">{label}</span>
        {hint && <span className="text-xs text-fg-muted">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
