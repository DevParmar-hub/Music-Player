'use client';

import type { ReactNode } from 'react';
import { motion } from 'motion/react';

import { useSettings } from '@/lib/stores/settings';

/**
 * Remounts on every navigation (see Next's template.js), giving each
 * page a soft entrance. "Calm" keeps only the fade.
 */
export default function Template({ children }: { children: ReactNode }) {
  const calm = useSettings((state) => state.motion !== 'full');

  return (
    <motion.div
      initial={calm ? { opacity: 0 } : { opacity: 0, y: 12, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: calm ? 0.2 : 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-full"
    >
      {children}
    </motion.div>
  );
}
