/** Build-time, world-readable config. No secrets here (ARCHITECTURE §6). */
const ENV = (import.meta.env.VITE_ENV ?? 'development') as 'development' | 'staging' | 'production';

export const config = {
  googleClientId: import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID ?? '',
  // Telemetry/entitlement backend. Defaults to the local web app in dev so
  // things work without extra env; empty in prod until the real host is set.
  backendUrl: import.meta.env.VITE_BACKEND_URL ?? (ENV === 'production' ? '' : 'http://localhost:3000'),
  sentryDsn: import.meta.env.VITE_SENTRY_DSN ?? '',
  env: ENV,
} as const;

export const isDev = config.env !== 'production';
