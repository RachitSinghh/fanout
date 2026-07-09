import { TOKEN_REGEX } from '../constants/tokens';

export interface ParsedToken {
  /** Token name, e.g. "FirstName". */
  name: string;
  /** Inline fallback text if written as {{Name|fallback}}, else null. */
  fallback: string | null;
}

/**
 * Extract every distinct {{Token}} from a string, preserving inline fallbacks.
 * If the same token appears with and without a fallback, the fallback wins.
 */
export function extractTokens(text: string): ParsedToken[] {
  const byName = new Map<string, ParsedToken>();
  // TOKEN_REGEX is global; reset lastIndex to keep calls independent.
  TOKEN_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_REGEX.exec(text)) !== null) {
    const name = (m[1] ?? '').trim();
    if (!name) continue;
    const fallback = m[2] !== undefined ? m[2] : null;
    const existing = byName.get(name);
    if (!existing) {
      byName.set(name, { name, fallback });
    } else if (existing.fallback === null && fallback !== null) {
      existing.fallback = fallback;
    }
  }
  return [...byName.values()];
}

/** Distinct token names across subject + body (the campaign's tokenSchema). */
export function tokenSchema(...texts: string[]): string[] {
  const names = new Set<string>();
  for (const t of texts) {
    for (const tok of extractTokens(t)) names.add(tok.name);
  }
  return [...names];
}
