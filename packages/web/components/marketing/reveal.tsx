'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';

/** Scroll-in fade-up — the landing's `.reveal` GSAP effect, ported to Framer
 *  Motion's whileInView (honors prefers-reduced-motion automatically). */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1], delay }}
    >
      {/* motion ships its own children type that React 19's ReactNode isn't
          assignable to (runtime is fine); relax at this one boundary. */}
      {children as never}
    </motion.div>
  );
}
