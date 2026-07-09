import { describe, it, expect } from 'vitest';
import {
  detectEmailColumn,
  detectColumnForToken,
  autoDetectMappings,
  buildRecipients,
} from './recipients';

describe('detectEmailColumn', () => {
  it('matches common email header spellings', () => {
    expect(detectEmailColumn(['Name', 'Email Address'])).toBe('Email Address');
    expect(detectEmailColumn(['e-mail'])).toBe('e-mail');
    expect(detectEmailColumn(['first', 'last'])).toBeNull();
  });
});

describe('detectColumnForToken', () => {
  it('fuzzy-maps name/company aliases', () => {
    const headers = ['first_name', 'Surname', 'Organization'];
    expect(detectColumnForToken('FirstName', headers)).toBe('first_name');
    expect(detectColumnForToken('LastName', headers)).toBe('Surname');
    expect(detectColumnForToken('Company', headers)).toBe('Organization');
  });

  it('falls back to an exact header match for custom tokens', () => {
    expect(detectColumnForToken('Role', ['role', 'x'])).toBe('role');
    expect(detectColumnForToken('Role', ['x'])).toBeNull();
  });
});

describe('autoDetectMappings', () => {
  it('always includes a required email mapping plus body tokens', () => {
    const m = autoDetectMappings(['Email', 'First'], ['FirstName']);
    expect(m.find((x) => x.token === 'email')?.column).toBe('Email');
    expect(m.find((x) => x.token === 'FirstName')?.column).toBe('First');
  });
});

describe('buildRecipients', () => {
  const rows = [
    { Email: 'a@x.com', First: 'A' },
    { Email: 'A@X.com', First: 'Dup' }, // duplicate (case-insensitive)
    { Email: 'not-an-email', First: 'B' }, // invalid
    { Email: '', First: 'C' }, // missing
    { Email: 'b@x.com', First: 'D' },
  ];

  it('validates, dedupes, and marks skips with reasons — never drops rows', () => {
    const { recipients, summary } = buildRecipients('c1', rows, 'Email');
    expect(recipients).toHaveLength(5); // nothing silently dropped
    expect(summary).toEqual({
      total: 5,
      valid: 2,
      invalidEmail: 1,
      missingEmail: 1,
      duplicate: 1,
    });
    const dup = recipients[1]!;
    expect(dup.status).toBe('skipped');
    expect(dup.skipReason).toBe('Duplicate');
    expect(recipients[2]!.skipReason).toBe('Invalid email');
    expect(recipients[3]!.skipReason).toBe('Missing email');
    expect(recipients[0]!.status).toBe('pending');
    // Full row data is preserved for personalization.
    expect(recipients[0]!.fields).toEqual({ Email: 'a@x.com', First: 'A' });
  });

  it('marks everything missing when no email column is chosen', () => {
    const { summary } = buildRecipients('c1', rows, null);
    expect(summary.missingEmail).toBe(5);
    expect(summary.valid).toBe(0);
  });
});
