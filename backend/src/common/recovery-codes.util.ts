import { randomInt } from 'crypto';

/** No 0/O or 1/I, which people misread when typing a code off paper. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const GROUP_LENGTH = 5;
export const RECOVERY_CODE_COUNT = 10;

/** `ABCDE-FGHJK`: 50 random bits, enough that guessing one is hopeless. */
export function generateRecoveryCode(): string {
  const pick = () =>
    Array.from(
      { length: GROUP_LENGTH },
      () => ALPHABET[randomInt(ALPHABET.length)],
    ).join('');
  return `${pick()}-${pick()}`;
}

/**
 * What gets hashed and compared: case, spaces and the dash don't matter,
 * so `abcde fghjk` and `ABCDE-FGHJK` are the same code.
 */
export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
