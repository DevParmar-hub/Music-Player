'use client';

import { useEffect } from 'react';
import { motion, useSpring, useTransform } from 'motion/react';

/** A number that rolls smoothly toward its latest value. */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const spring = useSpring(0, { stiffness: 70, damping: 20 });
  const text = useTransform(spring, (current) => Math.round(current).toLocaleString());

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <motion.span className={className}>{text}</motion.span>;
}
