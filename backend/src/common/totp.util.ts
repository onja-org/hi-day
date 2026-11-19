import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Time-based one-time passwords (RFC 6238) as authenticator apps such as
 * Google Authenticator and 1Password produce them: HMAC-SHA1, 6 digits,
 * 30-second steps. Hand-rolled because it's a few lines of `crypto`, and
 * pinned against the RFC's own test vectors in tests/totp.util.spec.ts.
 */
export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
/** One step either side, so a phone clock a little off still works. */
const ALLOWED_DRIFT_STEPS = 1;
const SECRET_BYTES = 20;
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** A fresh secret, base32-encoded the way authenticator apps expect. */
export function generateTotpSecret(): string {
  return encodeBase32(randomBytes(SECRET_BYTES));
}

/** What the QR code holds; scanning it adds the account to the app. */
export function buildOtpauthUrl(
  secret: string,
  accountName: string,
  issuer: string,
): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export function totpStepAt(timeMs: number): number {
  return Math.floor(timeMs / 1000 / TOTP_STEP_SECONDS);
}

export function generateTotp(secret: string, step: number): string {
  return hotp(decodeBase32(secret), step, TOTP_DIGITS);
}

/**
 * The step the code matched, or null. Steps at or before `lastUsedStep`
 * never match, so a code that has already signed someone in can't be
 * replayed while it is still on the screen.
 */
export function matchTotp(
  secret: string,
  code: string,
  timeMs: number,
  lastUsedStep: number | null,
): number | null {
  if (!new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(code)) {
    return null;
  }

  const key = decodeBase32(secret);
  const current = totpStepAt(timeMs);

  for (
    let step = current - ALLOWED_DRIFT_STEPS;
    step <= current + ALLOWED_DRIFT_STEPS;
    step++
  ) {
    if (lastUsedStep !== null && step <= lastUsedStep) continue;
    const expected = hotp(key, step, TOTP_DIGITS);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(code))) {
      return step;
    }
  }

  return null;
}

/** RFC 4226. Exported for the RFC's 8-digit test vectors. */
export function hotp(key: Buffer, counter: number, digits: number): string {
  const counterBytes = Buffer.alloc(8);
  counterBytes.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac('sha1', key).update(counterBytes).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3];

  return String(binary % 10 ** digits).padStart(digits, '0');
}

export function encodeBase32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/** Lenient about case, spaces and padding, as people type secrets by hand. */
export function decodeBase32(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/[\s=]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error('Invalid base32 character.');
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}
