import type { AuthState, UserIdentity, AccountType } from '@fanout/shared';
import { logger } from '../lib/logger';
import { broadcast } from '../messaging/channel';

/**
 * Option A auth (SECURITY_AND_ACCESS §1.1): Chrome brokers the Google login and
 * hands us a short-lived gmail.send access token. We store no password and no
 * refresh token. Identity for the backend/account-type comes from the userinfo
 * endpoint (the granted openid/email/profile scopes).
 */

const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

let cachedIdentity: UserIdentity | null = null;

function getAuthTokenAsync(interactive: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      const err = chrome.runtime.lastError;
      if (err || !token) {
        reject(new Error(err?.message ?? 'No token returned'));
        return;
      }
      resolve(typeof token === 'string' ? token : String(token));
    });
  });
}

function removeCachedToken(token: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
  });
}

/** Get a valid access token, prompting the user only when `interactive`. */
export async function getAccessToken(interactive = false): Promise<string> {
  return getAuthTokenAsync(interactive);
}

/**
 * Force a fresh token after a 401: drop the cached (possibly stale) token and
 * request a new one silently (FRONTEND_SPEC §8.1).
 */
export async function refreshAccessToken(staleToken: string): Promise<string> {
  await removeCachedToken(staleToken);
  return getAuthTokenAsync(false);
}

function accountTypeFromHd(hd: string | null): AccountType {
  if (hd && hd.length > 0) return 'workspace';
  return 'consumer';
}

async function fetchIdentity(token: string): Promise<UserIdentity> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`userinfo failed: ${res.status}`);
  const info = (await res.json()) as {
    sub?: string;
    email?: string;
    name?: string;
    hd?: string;
  };
  const hd = info.hd ?? null;
  return {
    email: info.email ?? '',
    name: info.name ?? info.email ?? '',
    sub: info.sub ?? null,
    hostedDomain: hd,
    // If we couldn't read hd for some reason, err to the safer 'unknown' cap.
    accountType: info.email ? accountTypeFromHd(hd) : 'unknown',
  };
}

/** Interactive connect: prompt consent, then resolve identity. */
export async function connect(): Promise<UserIdentity> {
  broadcast({ type: 'AUTH_CHANGED', state: { status: 'connecting', identity: null, error: null } });
  try {
    const token = await getAccessToken(true);
    const identity = await fetchIdentity(token);
    cachedIdentity = identity;
    logger.info('auth connected', { accountType: identity.accountType });
    broadcast({
      type: 'AUTH_CHANGED',
      state: { status: 'connected', identity, error: null },
    });
    return identity;
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Sign-in failed';
    broadcast({ type: 'AUTH_CHANGED', state: { status: 'error', identity: null, error } });
    throw e;
  }
}

/** Non-interactive state check for UI hydration. */
export async function getState(): Promise<AuthState> {
  try {
    const token = await getAccessToken(false);
    const identity = cachedIdentity ?? (await fetchIdentity(token));
    cachedIdentity = identity;
    return { status: 'connected', identity, error: null };
  } catch {
    return { status: 'disconnected', identity: null, error: null };
  }
}

export async function getIdentity(): Promise<UserIdentity | null> {
  if (cachedIdentity) return cachedIdentity;
  const state = await getState();
  return state.identity;
}

/** Revoke Fanout's access and clear the cached token. */
export async function disconnect(): Promise<void> {
  try {
    const token = await getAccessToken(false);
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: 'POST' });
    await removeCachedToken(token);
  } catch {
    // Already disconnected / no token — nothing to do.
  }
  cachedIdentity = null;
  broadcast({
    type: 'AUTH_CHANGED',
    state: { status: 'disconnected', identity: null, error: null },
  });
}
