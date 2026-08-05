import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react';

/** Shared, spec-aligned UI primitives (FRONTEND_SPEC §5). Tailwind-scoped. */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-[#131209] hover:bg-brand-700 active:bg-brand-700 disabled:bg-brand-950 disabled:text-neutral-500',
  secondary:
    'bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-strong)] hover:bg-[var(--surface-sunken)] active:bg-neutral-100 disabled:bg-neutral-100 disabled:text-neutral-400',
  ghost:
    'bg-transparent text-[var(--text-primary)] hover:bg-[var(--surface-sunken)] active:bg-neutral-100 disabled:text-neutral-400',
  danger:
    'bg-danger-fg text-white hover:bg-[#991B1B] active:bg-[#7F1D1D] disabled:opacity-60',
};

const SIZE: Record<Size, string> = {
  sm: 'h-7 px-3 text-label gap-2',
  md: 'h-9 px-4 text-label gap-2',
  lg: 'h-11 px-5 text-body-strong gap-2',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leadingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, leadingIcon, children, className = '', disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus-visible:shadow-focus disabled:cursor-not-allowed ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        leadingIcon
      )}
      {children}
    </button>
  );
});

export function Card({
  children,
  className = '',
  roomy,
}: {
  children: ReactNode;
  className?: string;
  roomy?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] ${roomy ? 'p-6' : 'p-4'} ${className}`}
    >
      {children}
    </div>
  );
}

type Tone = 'info' | 'success' | 'warning' | 'danger';
const TONE: Record<Tone, string> = {
  info: 'bg-info-bg border-info-border text-info-fg',
  success: 'bg-success-bg border-success-border text-success-fg',
  warning: 'bg-warning-bg border-warning-border text-warning-fg',
  danger: 'bg-danger-bg border-danger-border text-danger-fg',
};

export function Callout({
  tone = 'info',
  icon,
  children,
  className = '',
}: {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border p-3 text-body ${TONE[tone]} ${className}`}
    >
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div>{children}</div>
    </div>
  );
}

export function Badge({
  tone = 'info',
  children,
}: {
  tone?: Tone | 'neutral';
  children: ReactNode;
}) {
  const map: Record<string, string> = {
    ...TONE,
    neutral: 'bg-neutral-100 border-neutral-200 text-neutral-600',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-overline uppercase ${map[tone]}`}
    >
      {children}
    </span>
  );
}

/** Fanout mark — ink paper-plane on a gold rounded square (matches landing + icon). */
export function FanMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" fill="none" aria-hidden="true">
      <rect width="128" height="128" rx="30" fill="#E8B04B" />
      <g transform="translate(22 22) scale(3.5)">
        <path d="M22 2 15 22 11 13 2 9 22 2Z" fill="#131209" />
        <path d="M22 2 11 13" stroke="#E8B04B" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-sans font-bold text-[var(--text-primary)] ${className}`}>
      <FanMark size={18} />
      <span>Fanout</span>
    </span>
  );
}
