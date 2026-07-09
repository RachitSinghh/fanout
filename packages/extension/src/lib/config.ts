/** Build-time, world-readable config. No secrets here (ARCHITECTURE §6). */
export const config = {
  googleClientId: import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID ?? '',
  backendUrl: import.meta.env.VITE_BACKEND_URL ?? '',
  sentryDsn: import.meta.env.VITE_SENTRY_DSN ?? '',
  env: (import.meta.env.VITE_ENV ?? 'development') as
    | 'development'
    | 'staging'
    | 'production',
} as const;

export const isDev = config.env !== 'production';
