/**
 * RFC-lite email validation — deliberately permissive but rejects the obvious
 * garbage that would waste daily quota and look abusive to Google
 * (SECURITY_AND_ACCESS §4.4). Not a full RFC 5322 parser by design.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string | undefined | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  return EMAIL_RE.test(trimmed);
}

/** Normalize for dedupe/comparison: trim + lowercase. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
