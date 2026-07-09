import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EEF2FF', 100: '#E0E7FF', 200: '#C7D2FE', 300: '#A5B4FC', 400: '#818CF8',
          500: '#6366F1', 600: '#4F46E5', 700: '#4338CA', 800: '#3730A3', 900: '#312E81', 950: '#1E1B4B',
        },
        neutral: {
          0: '#FFFFFF', 50: '#F8FAFC', 100: '#F1F5F9', 200: '#E2E8F0', 300: '#CBD5E1', 400: '#94A3B8',
          500: '#64748B', 600: '#475569', 700: '#334155', 800: '#1E293B', 900: '#0F172A', 950: '#020617',
        },
        success: { fg: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
        warning: { fg: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
        danger: { fg: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
        info: { fg: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
        surface: 'var(--surface)',
        'surface-raised': 'var(--surface-raised)',
        'surface-sunken': 'var(--surface-sunken)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SF Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        display: ['1.75rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }],
        h1: ['1.375rem', { lineHeight: '1.25', letterSpacing: '-0.01em', fontWeight: '700' }],
        h2: ['1.125rem', { lineHeight: '1.3', fontWeight: '600' }],
        h3: ['1rem', { lineHeight: '1.4', fontWeight: '600' }],
        body: ['0.875rem', { lineHeight: '1.5' }],
        'body-strong': ['0.875rem', { lineHeight: '1.5', fontWeight: '600' }],
        label: ['0.8125rem', { lineHeight: '1.4', fontWeight: '500' }],
        caption: ['0.75rem', { lineHeight: '1.4', fontWeight: '500' }],
        overline: ['0.6875rem', { lineHeight: '1.3', letterSpacing: '0.08em', fontWeight: '600' }],
        'mono-sm': ['0.8125rem', { lineHeight: '1.5', fontWeight: '500' }],
      },
      borderRadius: { sm: '6px', md: '8px', lg: '12px', xl: '16px' },
      boxShadow: {
        xs: '0 1px 2px rgba(15,23,42,.06)',
        sm: '0 1px 3px rgba(15,23,42,.08),0 1px 2px rgba(15,23,42,.04)',
        md: '0 4px 12px rgba(15,23,42,.10)',
        lg: '0 12px 32px rgba(15,23,42,.14)',
        focus: '0 0 0 3px rgba(99,102,241,.45)',
      },
      zIndex: { backdrop: '10', modal: '20', popover: '30', toast: '40' },
    },
  },
  plugins: [],
} satisfies Config;
