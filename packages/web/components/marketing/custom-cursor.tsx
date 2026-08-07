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
      <svg viewBox="0 0 24 24" width="26" height="26">
        <path d="M3 2 L3 19.5 L16.5 13.5 Z" fill="#000000" stroke="#FFFFFF" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  );
}
