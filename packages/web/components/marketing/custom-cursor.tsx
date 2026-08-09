'use client';

import { useEffect, useRef } from 'react';

/** Custom arrow cursor — glides on desktop, grows over interactive targets.
 *  Ported from the landing (TICKET-037). Desktop-only; hidden on touch and for
 *  reduced-motion users (no smoothing loop). */
export function CustomCursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!matchMedia('(pointer: fine)').matches) return;
    const el = ref.current;
    if (!el) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.documentElement.classList.add('cursor-on');

    let hovering = false;
    let x = 0, y = 0, tx = 0, ty = 0, scale = 1, raf = 0;
    const render = () => {
      el.style.transform = `translate(${x - 3}px, ${y - 2}px) scale(${scale})`;
    };
    const loop = () => {
      x += (tx - x) * 0.2;
      y += (ty - y) * 0.2;
      render();
      raf = requestAnimationFrame(loop);
    };
    if (!reduced) raf = requestAnimationFrame(loop);

    const interactive = 'a, button, summary, input, [role=button]';
    const onMove = (e: PointerEvent) => {
      tx = e.clientX; ty = e.clientY;
      if (reduced) { x = tx; y = ty; render(); }
      el.style.opacity = '1';
    };
    const onDown = () => { scale = hovering ? 1.4 : 0.8; };
    const onUp = () => { scale = hovering ? 1.7 : 1; };
    const onOver = (e: PointerEvent) => {
      if ((e.target as Element).closest?.(interactive)) { hovering = true; scale = 1.7; }
    };
    const onOut = (e: PointerEvent) => {
      if ((e.target as Element).closest?.(interactive)) { hovering = false; scale = 1; }
    };
    const onLeave = () => { el.style.opacity = '0'; };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerout', onOut);
    document.addEventListener('mouseleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove('cursor-on');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden className="fanout-cursor">
      {/* Figma-style pointer: curved tail (cubic edges, not the flat macOS arrow). */}
      <svg viewBox="0 0 24 24" width="24" height="24">
        <path
          d="M3 2 L4.3 16.8 C4.45 18 5.2 18.2 5.8 17.4 L7.9 14.6 C8.1 14.3 8.5 14.2 8.9 14.35 L12.5 15.7 C13.7 16.1 14.4 14.8 13.6 13.9 Z"
          fill="#E8B04B"
          stroke="#1A1A1A"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
