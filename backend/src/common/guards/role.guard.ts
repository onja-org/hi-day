import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { REQUIRE_ROLE_KEY } from '../decorators/require-role.decorator';

/**
 * Enforces @RequireRole(...) on a route. Must run after JwtAuthGuard (needs
 * request.userId already set). Reads the target Organisation's id from the
 * route's `:id` param and re-resolves the caller's Membership + role from
 * the database — never trusts a role claim, since none exists on the JWT.
 */
@Injectable()
export class RoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<
      MembershipRole[] | undefined
    >(REQUIRE_ROLE_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const organisationId = String(request.params.id);

    const membership = await this.memberships.findOne({
      where: { userId: request.userId, organisationId },
    });

    if (!membership || !requiredRoles.includes(membership.role)) {
      throw new ForbiddenException(
        'You do not have the required role for this organisation.',
      );
    }

    return true;
  }
}
