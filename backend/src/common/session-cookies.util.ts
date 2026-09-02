import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from '../auth/services/token.service';
import { buildSessionCookieOptions } from './cookies.util';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ACCESS_TOKEN_COOKIE_MAX_AGE_MS = 15 * 60 * 1000;
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
  const refreshTokenTtlDays = Number(
    configService.get('REFRESH_TOKEN_TTL_DAYS', DEFAULT_REFRESH_TOKEN_TTL_DAYS),
  );

  response.cookie(
    ACCESS_TOKEN_COOKIE,
    accessToken,
    buildSessionCookieOptions(ACCESS_TOKEN_COOKIE_MAX_AGE_MS, configService),
  );
  response.cookie(
    REFRESH_TOKEN_COOKIE,
    refreshToken,
    buildSessionCookieOptions(refreshTokenTtlDays * MS_PER_DAY, configService),
  );
}
