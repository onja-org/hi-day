import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { TwoFactorSecretCipher } from '../two-factor-secret-cipher.service';

function makeCipher(key = randomBytes(32).toString('base64')) {
  return new TwoFactorSecretCipher({
    getOrThrow: () => key,
  } as unknown as ConfigService);
}

describe('TwoFactorSecretCipher', () => {
  it('round-trips a secret', () => {
    const cipher = makeCipher();
    expect(cipher.decrypt(cipher.encrypt('JBSWY3DPEHPK3PXP'))).toBe(
      'JBSWY3DPEHPK3PXP',
    );
  });

  it('never stores the secret in the clear, and encrypts it differently each time', () => {
    const cipher = makeCipher();
    const first = cipher.encrypt('JBSWY3DPEHPK3PXP');
    expect(first).not.toContain('JBSWY3DPEHPK3PXP');
    expect(cipher.encrypt('JBSWY3DPEHPK3PXP')).not.toBe(first);
  });

  it('refuses to decrypt with a different key', () => {
    const stored = makeCipher().encrypt('JBSWY3DPEHPK3PXP');
    expect(() => makeCipher().decrypt(stored)).toThrow();
  });

  it('refuses to start with a key of the wrong length', () => {
    expect(() => makeCipher(randomBytes(16).toString('base64'))).toThrow(
      /32 bytes/,
    );
  });
});
