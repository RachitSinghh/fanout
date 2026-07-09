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
} as const;
