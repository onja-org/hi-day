import { createHmac, timingSafeEqual } from 'crypto';
import {
  SUMMARY_EMAIL_KINDS,
  type SummaryEmailKind,
} from '../organisations/summary-emails';

/** Keeps these signatures from ever matching one made with the same secret
 * for something else. */
const PURPOSE = 'summary-email-unsubscribe:v1';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface UnsubscribeTarget {
  membershipId: string;
  kind: SummaryEmailKind;
}

function sign(payload: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(`${PURPOSE}|${payload}`).digest();
}

/**
 * The "Turn off this email" link's token. It never expires — an old email's
 * link should still work — and it can only ever switch one email *off*, so
 * there is nothing for someone holding it to gain.
 */
export function createUnsubscribeToken(
  target: UnsubscribeTarget,
  secret: string,
): string {
  const payload = `${target.membershipId}.${target.kind}`;
  return `${payload}.${sign(payload, secret).toString('base64url')}`;
}

/** The target, or `null` for anything malformed or not signed by us. */
export function verifyUnsubscribeToken(
  token: string,
  secret: string,
): UnsubscribeTarget | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [membershipId, kind, signature] = parts;
  if (!UUID.test(membershipId)) return null;
  if (!(SUMMARY_EMAIL_KINDS as readonly string[]).includes(kind)) return null;

  const expected = sign(`${membershipId}.${kind}`, secret);
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }
  return { membershipId, kind: kind as SummaryEmailKind };
}
