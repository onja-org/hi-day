import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from '../auth/services/token.service';
import { buildSessionCookieOptions } from './cookies.util';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Also the fallback JwtAuthModule uses to sign the JWT itself, so the
// cookie's browser-facing max-age and the token's own exp claim can't drift
// apart — see ACCESS_TOKEN_TTL_DAYS in .env.example.
export const DEFAULT_ACCESS_TOKEN_TTL_DAYS = 14;
const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 30;

/**
 * Issues the access + refresh token cookies for a newly-established session.
 * Shared by any flow that logs the caller in as a side effect (password
 * set/reset, invitation accept) so there's one place session cookie
 * lifetimes are decided.
 */
export function setSessionCookies(
  response: Response,
  accessToken: string,
  refreshToken: string,
  configService: ConfigService,
): void {
  setAccessTokenCookie(response, accessToken, configService);

  const refreshTokenTtlDays = Number(
    configService.get('REFRESH_TOKEN_TTL_DAYS', DEFAULT_REFRESH_TOKEN_TTL_DAYS),
  );

  response.cookie(
    REFRESH_TOKEN_COOKIE,
    refreshToken,
    buildSessionCookieOptions(refreshTokenTtlDays * MS_PER_DAY, configService),
  );
}

/**
 * Renews only the access-token cookie, leaving the refresh-token cookie as
 * the browser has it. For a refresh that lost a race to a concurrent one:
 * that request's response sets the one live refresh token.
 */
export function setAccessTokenCookie(
  response: Response,
  accessToken: string,
  configService: ConfigService,
): void {
  const accessTokenTtlDays = Number(
    configService.get('ACCESS_TOKEN_TTL_DAYS', DEFAULT_ACCESS_TOKEN_TTL_DAYS),
  );

  response.cookie(
    ACCESS_TOKEN_COOKIE,
    accessToken,
    buildSessionCookieOptions(accessTokenTtlDays * MS_PER_DAY, configService),
  );
}

/** Ends the browser session without touching any stored refresh token. */
export function clearSessionCookies(response: Response): void {
  response.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
  response.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
}
