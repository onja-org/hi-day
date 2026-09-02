import { ConfigService } from '@nestjs/config';
import type { CookieOptions } from 'express';
import type { Request } from 'express';

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.cookie;
  if (!header) {
    return undefined;
  }

  const match = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

export function buildSessionCookieOptions(
  maxAgeMs: number,
  configService: ConfigService,
): CookieOptions {
  return {
    httpOnly: true,
    secure: configService.get('NODE_ENV') === 'production',
    sameSite: 'lax',
    maxAge: maxAgeMs,
  };
}
