import { cn } from '@/lib/cn';

/**
 * Three little bars that dance while music plays: the pink
 * "now playing" mark. They rest low when paused.
 */
export function PlayingBars({ playing, className }: { playing: boolean; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('inline-flex h-3 items-end gap-[2px]', className)}>
      {[0, 1, 2].map((bar) => (
        <span
          key={bar}
          className={cn(
            'w-[3px] origin-bottom rounded-full bg-love',
            playing ? 'animate-[playing-bar_0.9s_ease-in-out_infinite]' : 'h-1',
          )}
          style={playing ? { height: '100%', animationDelay: `${bar * -0.3}s` } : undefined}
        />
      ))}
    </span>
  );
}
