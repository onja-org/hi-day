import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { readCookie } from '../common/cookies.util';
import { AccessTokenService } from './services/access-token.service';
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
  constructor(private readonly accessTokenService: AccessTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readCookie(request, ACCESS_TOKEN_COOKIE);

    if (!token) {
      throw new UnauthorizedException('Not authenticated.');
    }

    const userId = await this.accessTokenService.verify(token);
    if (!userId) {
      throw new UnauthorizedException('Not authenticated.');
    }

    request.userId = userId;
    return true;
  }
}
