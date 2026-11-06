import { randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

/** Access tokens are signed by `AccessTokenService`. */
@Injectable()
export class TokenService {
  generateToken(): string {
    return randomBytes(32).toString('hex');
  }
}
