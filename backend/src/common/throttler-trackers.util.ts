import type { Request } from 'express';
import { REFRESH_TOKEN_COOKIE } from '../auth/services/token.service';
import { readCookie } from './cookies.util';
import { hashToken } from './hash-token.util';

/**
 * Behind the Next.js proxy every request arrives from one address, so a
 * per-IP key buckets the whole user base together. These key a limit on what
 * the request itself names instead.
 *
 * With nothing to name they return NO_IDENTIFIER rather than falling back to
 * `req.ip`, which would restore the shared bucket. Only requests too
 * malformed to name an actor land there, so they throttle each other and
 * never a real caller; raw volume is the `default` throttler's job.
 */
const NO_IDENTIFIER = 'no-identifier';

export function emailTracker(req: Request): string {
  const email = (req.body as { email?: unknown } | undefined)?.email;
  return typeof email === 'string' && email.trim().length > 0
    ? email.trim().toLowerCase()
    : NO_IDENTIFIER;
}

/** Hashed, so a refresh token never becomes a rate-limiter key. */
export function sessionTracker(req: Request): string {
  const refreshToken = readCookie(req, REFRESH_TOKEN_COOKIE);
  return refreshToken ? hashToken(refreshToken) : NO_IDENTIFIER;
}

/** Password reset, where the token is in the body. */
export function bodyTokenTracker(req: Request): string {
  const token = (req.body as { token?: unknown } | undefined)?.token;
  return typeof token === 'string' && token.length > 0
    ? hashToken(token)
    : NO_IDENTIFIER;
}

/** Invitations and invite links, where the token is in the URL. */
export function routeTokenTracker(req: Request): string {
  const token = (req.params as { token?: string } | undefined)?.token;
  return token ? hashToken(token) : NO_IDENTIFIER;
}
