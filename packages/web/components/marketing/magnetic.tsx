'use client';

import { useRef, cloneElement, type ReactElement } from 'react';
import { animate } from 'motion';

/** Magnetic pull on a primary CTA — the element leans toward the cursor and
 *  springs back on leave (ported from the landing's Motion One effect). Attaches
 *  to the child directly so its layout classes are untouched. No-ops on
 *  touch / reduced-motion. */
export function Magnetic({ children }: { children: ReactElement }) {
  const ref = useRef<HTMLElement>(null);

  const enabled = () =>
    typeof matchMedia !== 'undefined' &&
    matchMedia('(pointer: fine)').matches &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches;

  return cloneElement(children as ReactElement<Record<string, unknown>>, {
    ref,
    style: { willChange: 'transform' },
    onPointerMove: (e: React.PointerEvent) => {
      const el = ref.current;
      if (!el || !enabled()) return;
      const r = el.getBoundingClientRect();
      animate(
        el,
        { x: (e.clientX - r.left - r.width / 2) * 0.28, y: (e.clientY - r.top - r.height / 2) * 0.5 },
        { duration: 0.4, ease: [0.32, 0.72, 0, 1] },
      );
    },
    onPointerLeave: () => {
      const el = ref.current;
      if (!el) return;
      animate(el, { x: 0, y: 0 }, { type: 'spring', stiffness: 160, damping: 14 });
    },
  });
}
