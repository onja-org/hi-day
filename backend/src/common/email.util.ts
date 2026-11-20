import { ValueTransformer } from 'typeorm';

/**
 * The one canonical form of an email address: trimmed and lowercased.
 * Every address is stored and looked up in this form, so `Jane@corp.com`
 * (a mobile keyboard's auto-capitalisation) and `jane@corp.com` are the
 * same account and the same invitee.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Column transformer for email columns. TypeORM applies `to` both when
 * writing and to `find`/`findOne` where-values, so every repository save
 * and lookup is normalised without each call site remembering to. Raw
 * QueryBuilder `where` strings are not covered — normalise those by hand.
 */
export const emailColumnTransformer: ValueTransformer = {
  to: (value: unknown) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  from: (value: unknown) => value,
};
