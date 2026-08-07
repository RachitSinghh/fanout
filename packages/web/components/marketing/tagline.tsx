'use client';

import { useRef, useState, useEffect } from 'react';
import { useScroll, useMotionValueEvent } from 'motion/react';

const TEXT =
  'Not a mass mailer. A personalization tool that treats every recipient as a single, deliberate email from you.';
const WORDS = TEXT.split(' ');

/** Tagline whose words warm muted → white as you scroll past, in reading order
 *  (ported from the landing's scrubbed GSAP reveal, TICKET-037). */
export function Tagline() {
  const ref = useRef<HTMLDivElement>(null);
  const [lit, setLit] = useState(0);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.78', 'start 0.32'],
  });
  useMotionValueEvent(scrollYProgress, 'change', (p) => setLit(Math.round(p * WORDS.length)));

  // Reduced motion: show it fully lit, no scroll dependency.
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) setLit(WORDS.length);
  }, []);

  return (
    <div
      ref={ref}
      className="mx-auto max-w-[680px] text-center text-4xl font-semibold leading-tight tracking-tight text-balance md:text-5xl"
    >
      {WORDS.map((w, i) => (
        <span key={i} className={i < lit ? 'text-white' : 'text-white/25'}>
          {w}{' '}
        </span>
      ))}
    </div>
  );
}
