import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FDF6E8', 100: '#F9E9C6', 200: '#F2D59A', 300: '#ECC470', 400: '#E8B04B',
          500: '#E8B04B', 600: '#E8B04B', 700: '#D69A35', 800: '#A8792A', 900: '#6F5019', 950: '#2A2110',
        },
        neutral: {
          0: '#FFFFFF', 50: '#F6F5F2', 100: '#ECEBE7', 200: '#D9D8D3', 300: '#B6B5AF', 400: '#9B9B9B',
          500: '#77766F', 600: '#4A4A46', 700: '#313131', 800: '#1F1F1F', 900: '#181818', 950: '#131209',
        },
        success: { fg: '#34D399', bg: '#ECFDF5', border: '#A7F3D0' },
        warning: { fg: '#E8B04B', bg: '#FDF6E8', border: '#F2D59A' },
        danger: { fg: '#F87171', bg: '#FEF2F2', border: '#FECACA' },
        info: { fg: '#60A5FA', bg: '#EFF6FF', border: '#BFDBFE' },
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
        sans: ['"Geist Variable"', 'Geist', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SF Mono', 'Menlo', 'Consolas', 'monospace'],
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
