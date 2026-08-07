import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Compact date + time picker themed to the Fanout palette (TICKET-016). Kept
 * dependency-free and self-styled so it lives cleanly in the Shadow-DOM overlay —
 * shadcn/react-day-picker belong to the web app, not here (FRONTEND_SPEC §1).
 */

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // :00, :05 … :55

function defaultStart(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0); // next whole hour
  return d;
}

/** 6×7 grid of Dates covering the month `month`/`year`, padded to whole weeks. */
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay()); // back up to Sunday
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const dayBefore = (a: Date, b: Date) => {
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return da < db;
};

export function DateTimePicker({
  value,
  onChange,
  minMs = 0,
}: {
  value: number | null;
  onChange: (ms: number) => void;
  minMs?: number;
}) {
  const [sel, setSel] = useState<Date>(value != null ? new Date(value) : defaultStart());
  const [viewY, setViewY] = useState(sel.getFullYear());
  const [viewM, setViewM] = useState(sel.getMonth());
  const minDate = new Date(minMs);

  // Seed the parent with the default selection so the action is enabled on open.
  useEffect(() => {
    if (value == null) onChange(sel.getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hour12 = ((sel.getHours() + 11) % 12) + 1; // 1..12
  const ampm: 'AM' | 'PM' = sel.getHours() < 12 ? 'AM' : 'PM';
  const minute = Math.min(55, Math.round(sel.getMinutes() / 5) * 5);

  const commit = (next: Date) => {
    setSel(next);
    setViewY(next.getFullYear());
    setViewM(next.getMonth());
    onChange(next.getTime());
  };

  const withTime = (h12: number, min: number, mer: 'AM' | 'PM') => {
    let h = h12 % 12;
    if (mer === 'PM') h += 12;
    return new Date(sel.getFullYear(), sel.getMonth(), sel.getDate(), h, min, 0, 0);
  };

  const stepMonth = (delta: number) => {
    const m = viewM + delta;
    setViewY(viewY + Math.floor(m / 12));
    setViewM(((m % 12) + 12) % 12);
  };

  const cells = monthGrid(viewY, viewM);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)] p-3">
      {/* Month nav */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-body-strong text-[var(--text-primary)]">
          {MONTHS[viewM]} {viewY}
        </span>
        <div className="flex gap-1">
          <NavBtn label="Previous month" onClick={() => stepMonth(-1)}>
            <ChevronLeft size={16} />
          </NavBtn>
          <NavBtn label="Next month" onClick={() => stepMonth(1)}>
            <ChevronRight size={16} />
          </NavBtn>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 text-center text-overline uppercase text-[var(--text-muted)]">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="py-1">{d}</span>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === viewM;
          const isSel = sameDay(d, sel);
          const isToday = sameDay(d, new Date());
          const disabled = dayBefore(d, minDate);
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => commit(new Date(d.getFullYear(), d.getMonth(), d.getDate(), sel.getHours(), sel.getMinutes()))}
              className={[
                'mx-auto grid h-9 w-9 place-items-center rounded-lg text-label transition-colors',
                isSel
                  ? 'bg-brand-600 font-semibold text-[#131209]'
                  : disabled
                    ? 'text-neutral-600'
                    : inMonth
                      ? 'text-[var(--text-primary)] hover:bg-[var(--surface)]'
                      : 'text-[var(--text-muted)] hover:bg-[var(--surface)]',
                isToday && !isSel ? 'ring-1 ring-inset ring-[var(--border-strong)]' : '',
                disabled ? 'cursor-not-allowed hover:bg-transparent' : '',
              ].join(' ')}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      {/* Time row */}
      <div className="mt-3 flex items-center gap-2 border-t border-[var(--border)] pt-3">
        <span className="text-label text-[var(--text-muted)]">At</span>
        <TimeSelect
          value={hour12}
          onChange={(h) => commit(withTime(h, minute, ampm))}
          options={Array.from({ length: 12 }, (_, i) => i + 1)}
          format={(n) => String(n)}
        />
        <span className="text-[var(--text-muted)]">:</span>
        <TimeSelect
          value={minute}
          onChange={(m) => commit(withTime(hour12, m, ampm))}
          options={MINUTES}
          format={(n) => String(n).padStart(2, '0')}
        />
        <div className="ml-auto inline-flex rounded-lg border border-[var(--border-strong)] p-0.5">
          {(['AM', 'PM'] as const).map((mer) => (
            <button
              key={mer}
              type="button"
              onClick={() => commit(withTime(hour12, minute, mer))}
              className={[
                'rounded-md px-2.5 py-1 text-label transition-colors',
                ampm === mer
                  ? 'bg-brand-600 font-semibold text-[#131209]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface)]',
              ].join(' ')}
            >
              {mer}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function NavBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface)] focus:outline-none focus-visible:shadow-focus"
    >
      {children}
    </button>
  );
}

function TimeSelect({
  value,
  onChange,
  options,
  format,
}: {
  value: number;
  onChange: (n: number) => void;
  options: number[];
  format: (n: number) => string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1 text-label text-[var(--text-primary)] focus:outline-none focus-visible:shadow-focus"
    >
      {options.map((n) => (
        <option key={n} value={n}>{format(n)}</option>
      ))}
    </select>
  );
}
