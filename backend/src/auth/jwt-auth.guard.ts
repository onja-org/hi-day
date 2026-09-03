import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { readCookie } from '../common/cookies.util';
import { ACCESS_TOKEN_COOKIE } from './services/token.service';

export interface AuthenticatedRequest extends Request {
  userId: string;
  /**
   * The internal Organisation UUID, resolved from the route's `:id`
   * (a public-facing numeric id — see docs/adr/0007) by RoleGuard. Only set
   * once RoleGuard has run.
   */
  organisationId?: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readCookie(request, ACCESS_TOKEN_COOKIE);

    if (!token) {
      throw new UnauthorizedException('Not authenticated.');
    }

    try {
      const payload = this.jwtService.verify<{ sub: string }>(token);
      request.userId = payload.sub;
      return true;
    } catch {
      throw new UnauthorizedException('Not authenticated.');
    }
  }
}
