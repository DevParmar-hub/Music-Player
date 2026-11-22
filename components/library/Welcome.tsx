'use client';

import { FolderPlus, HardDrive, ShieldCheck, WifiOff } from 'lucide-react';

import Aurora from '@/components/reactbits/Aurora';
import BlurText from '@/components/reactbits/BlurText';
import { LogoMark } from '@/components/shell/LogoMark';
import { Button } from '@/components/ui/Button';
import { CountUp } from '@/components/ui/CountUp';
import { useResolvedTheme } from '@/lib/hooks/useResolvedTheme';
import { scanFraction, useScan } from '@/lib/stores/scan';
import { useSettings } from '@/lib/stores/settings';

const AURORA_COLORS = ['#00cfc4', '#ff6a96', '#02a89f'];

const PROMISES = [
  { icon: HardDrive, text: 'Plays your files where they already are' },
  { icon: ShieldCheck, text: 'Never moves, renames or edits them' },
  { icon: WifiOff, text: 'Works fully offline' },
];

/** First-run screen: an aurora, one promise, one button. */
export function Welcome() {
  const theme = useResolvedTheme();
  const motion = useSettings((state) => state.motion);
  const running = useScan((state) => state.running);
  const progress = useScan((state) => state.progress);
  const addFolder = useScan((state) => state.addFolder);
  const fraction = scanFraction(progress);

  return (
    <section className="relative isolate flex min-h-[calc(100dvh-84px)] flex-col items-center justify-center overflow-hidden px-10 py-16 text-center">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-[70%]">
        <Aurora
          colorStops={AURORA_COLORS}
          amplitude={1.1}
          blend={0.6}
          speed={0.6}
          opacity={theme === 'dark' ? 0.55 : 0.5}
          lightMode={theme === 'light'}
          paused={motion !== 'full'}
          intro={motion === 'full'}
          mouseInteraction={motion === 'full'}
        />
      </div>

      <LogoMark className="mb-8 size-14" />

      {motion === 'full' ? (
        <BlurText
          as="h1"
          text="Your music, beautifully kept."
          trigger="load"
          delay={90}
          stepDuration={0.4}
          className="max-w-3xl justify-center font-display text-6xl leading-[1.05] tracking-tight text-fg"
        />
      ) : (
        <h1 className="max-w-3xl font-display text-6xl leading-[1.05] tracking-tight text-fg">
          Your music, beautifully kept.
        </h1>
      )}

      <p className="mt-5 max-w-md text-base text-fg-muted">
        Point us at the folder your music lives in. We&apos;ll read every song, find the covers and
        build your library.
      </p>

      {running ? (
        <div role="status" aria-live="polite" className="mt-10 flex w-full max-w-sm flex-col items-center gap-4">
          <p className="text-sm text-fg-muted">
            <CountUp value={progress?.inserted ?? 0} className="font-display text-5xl text-fg tabular-nums" />
            <span className="mt-1 block">songs found so far</span>
          </p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-500 to-pink-400 transition-[width] duration-300"
              style={{ width: `${(fraction ?? 0.03) * 100}%` }}
            />
          </div>
        </div>
      ) : (
        <Button
          variant="primary"
          icon={<FolderPlus className="size-4" />}
          onClick={addFolder}
          className="mt-10 h-12 px-6 text-base"
        >
          Choose music folder
        </Button>
      )}

      <ul className="mt-12 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-fg-muted">
        {PROMISES.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-2">
            <Icon className="size-4 text-accent-text" /> {text}
          </li>
        ))}
      </ul>
    </section>
  );
}
