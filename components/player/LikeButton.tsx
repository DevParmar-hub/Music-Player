'use client';

import { motion } from 'motion/react';
import { Heart } from 'lucide-react';

import ClickSpark from '@/components/reactbits/ClickSpark';
import { IconButton } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { setFavorite } from '@/lib/actions/favorites';
import { useSettings } from '@/lib/stores/settings';
import type { Track } from '@/lib/tauri/types';

const SPARK_COLORS = ['#ff6a96', '#fe97b0', '#00cfc4'];

/** Heart that pops and throws pink sparks when you like a song. */
export function LikeButton({ track }: { track: Track | null }) {
  const fullMotion = useSettings((state) => state.motion === 'full');
  const liked = track?.favorite ?? false;

  return (
    // Sparks only on liking, never on un-liking.
    <ClickSpark
      sparkColor={SPARK_COLORS}
      sparkCount={10}
      sparkRadius={20}
      sparkSize={7}
      duration={450}
      disabled={liked || !track || !fullMotion}
      style={{ display: 'inline-flex', width: 'auto', height: 'auto' }}
    >
      <IconButton
        label={liked ? 'Remove from liked songs' : 'Like'}
        aria-pressed={liked}
        size="sm"
        disabled={!track}
        onClick={() => track && setFavorite(track.id, !liked)}
      >
        <motion.span
          key={liked ? 'liked' : 'not-liked'}
          initial={liked ? { scale: 0.5 } : false}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', bounce: 0.6, duration: 0.45 }}
          className="flex"
        >
          <Heart className={cn('size-4', liked && 'fill-love text-love')} />
        </motion.span>
      </IconButton>
    </ClickSpark>
  );
}
