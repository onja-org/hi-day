import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const VERSION = 'v1';

/**
 * Encrypts authenticator secrets at rest. Unlike a password or token, the
 * server has to read the secret back to check a code, so it can't be
 * hashed. Encrypting it with a key kept outside the database means a leaked
 * database alone doesn't let anyone generate codes.
 *
 * Stored as `v1:<iv>:<tag>:<ciphertext>`, all base64.
 */
@Injectable()
export class TwoFactorSecretCipher {
  private readonly key: Buffer;

  constructor(configService: ConfigService) {
    const key = Buffer.from(
      configService.getOrThrow<string>('TWO_FACTOR_ENCRYPTION_KEY'),
      'base64',
    );
    if (key.length !== KEY_BYTES) {
      throw new Error(
        `TWO_FACTOR_ENCRYPTION_KEY must be ${KEY_BYTES} bytes, base64-encoded (openssl rand -base64 32).`,
      );
    }
    this.key = key;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    return [
      VERSION,
      iv.toString('base64'),
      cipher.getAuthTag().toString('base64'),
      ciphertext.toString('base64'),
    ].join(':');
  }

  decrypt(stored: string): string {
    const [version, iv, tag, ciphertext] = stored.split(':');
    if (version !== VERSION || !iv || !tag || !ciphertext) {
      throw new Error('Unrecognised two-factor secret format.');
    }
    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
