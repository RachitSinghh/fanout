import { useEffect, type ReactNode } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { spring, duration } from '../motion/tokens';

/** Centered confirm/alert dialog rendered above the overlay panel
 *  (FRONTEND_SPEC §5.4). Esc closes unless `blockEscape`. */
export function Dialog({
  open,
  onClose,
  icon,
  title,
  children,
  actions,
  blockEscape,
}: {
  open: boolean;
  onClose: () => void;
  icon?: ReactNode;
  title: string;
  children: ReactNode;
  actions: ReactNode;
  blockEscape?: boolean;
}) {
  useEffect(() => {
    if (!open || blockEscape) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, blockEscape, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <m.div
          className="fixed inset-0 z-popover flex items-center justify-center"
          style={{ background: 'rgba(15,23,42,0.45)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: duration.fast }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !blockEscape) onClose();
          }}
        >
          <m.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="w-[440px] max-w-[90vw] rounded-xl bg-[var(--surface)] p-6 shadow-lg"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={spring.default}
          >
            {icon && <div className="mb-3">{icon}</div>}
            <h1 className="text-h1">{title}</h1>
            <div className="mt-2 text-body text-[var(--text-secondary)]">{children}</div>
            <div className="mt-5 flex justify-end gap-3">{actions}</div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
