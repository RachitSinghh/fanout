import { db } from './schema';

/** Small typed helpers over the single-row key/value settings table. */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await db.settings.put({ key, value });
}

export const SETTING_KEYS = {
  defaultThrottle: 'defaultThrottle',
  defaultDailyCap: 'defaultDailyCap',
  lastColumnMappings: 'lastColumnMappings',
  cachedIdentity: 'cachedIdentity',
  cachedLicense: 'cachedLicense',
  /** Opt-out toggle for aggregate diagnostics (TICKET-034); default on. */
  shareDiagnostics: 'shareDiagnostics',
  /** Dev-only override to force a plan tier for the entitlement stub (TICKET-035). */
  planOverride: 'planOverride',
} as const;
