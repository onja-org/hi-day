import {
  buildOtpauthUrl,
  decodeBase32,
  encodeBase32,
  generateTotp,
  generateTotpSecret,
  hotp,
  matchTotp,
  totpStepAt,
} from '../totp.util';

// RFC 6238 appendix B: SHA1 with the ASCII key "12345678901234567890".
const RFC_KEY = Buffer.from('12345678901234567890', 'ascii');
const RFC_SECRET = encodeBase32(RFC_KEY);

describe('totp.util', () => {
  it.each([
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
  ])('matches the RFC 6238 test vector at T=%i', (seconds, expected) => {
    expect(hotp(RFC_KEY, totpStepAt(seconds * 1000), 8)).toBe(expected);
  });

  it('round-trips base32', () => {
    expect(decodeBase32(RFC_SECRET)).toEqual(RFC_KEY);
    expect(decodeBase32(RFC_SECRET.toLowerCase())).toEqual(RFC_KEY);
  });

  it('generates a 32-character base32 secret', () => {
    expect(generateTotpSecret()).toMatch(/^[A-Z2-7]{32}$/);
  });

  describe('matchTotp', () => {
    const now = 1_700_000_000_000;
    const step = totpStepAt(now);

    it('accepts the current code and returns its step', () => {
      const code = generateTotp(RFC_SECRET, step);
      expect(matchTotp(RFC_SECRET, code, now, null)).toBe(step);
    });

    it('accepts a code one step either side', () => {
      expect(
        matchTotp(RFC_SECRET, generateTotp(RFC_SECRET, step - 1), now, null),
      ).toBe(step - 1);
      expect(
        matchTotp(RFC_SECRET, generateTotp(RFC_SECRET, step + 1), now, null),
      ).toBe(step + 1);
    });

    it('refuses a code two steps away', () => {
      expect(
        matchTotp(RFC_SECRET, generateTotp(RFC_SECRET, step - 2), now, null),
      ).toBeNull();
    });

    it('refuses a code whose step has already been used', () => {
      const code = generateTotp(RFC_SECRET, step);
      expect(matchTotp(RFC_SECRET, code, now, step)).toBeNull();
    });

    it('refuses anything that is not six digits', () => {
      expect(matchTotp(RFC_SECRET, '12345', now, null)).toBeNull();
      expect(matchTotp(RFC_SECRET, 'abcdef', now, null)).toBeNull();
    });
  });

  it('builds an otpauth URL authenticator apps can read', () => {
    const url = buildOtpauthUrl('ABC', 'jane@acme.test', 'Hi Day');
    expect(url).toBe(
      'otpauth://totp/Hi%20Day%3Ajane%40acme.test?secret=ABC&issuer=Hi+Day&algorithm=SHA1&digits=6&period=30',
    );
  });
});
