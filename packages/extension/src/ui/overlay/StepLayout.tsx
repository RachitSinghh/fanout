import type { ReactNode } from 'react';

/** Shared step scaffold: a scrolling content region above a sticky action bar
 *  (FRONTEND_SPEC §4.3). */
export function StepLayout({
  children,
  footer,
}: {
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</div>
      <div className="flex h-16 items-center justify-between border-t border-[var(--border)] bg-[var(--surface)]/95 px-6 backdrop-blur">
        {footer}
      </div>
    </div>
  );
}
