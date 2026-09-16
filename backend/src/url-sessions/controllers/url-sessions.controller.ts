import { Controller, Delete, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import type {
  UrlActivityDay,
  UrlSessionGroup,
} from '../services/url-sessions.service';
import { UrlSessionsService } from '../services/url-sessions.service';

// Not scoped to a :projectId — this is per-member browsing history, same
// shape as time-entries' own "whatever the caller's own timer is doing"
// routes. `membershipId` is optional on `list` and defaults to the
// caller's own — see UrlSessionsService.listGroupedByUrl for who's
// allowed to pass someone else's.
@Controller('organisations/:id/url-sessions')
@UseGuards(JwtAuthGuard, RoleGuard)
export class UrlSessionsController {
  constructor(private readonly urlSessionsService: UrlSessionsService) {}

  @Get()
  list(
    @Query('membershipId') membershipId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<UrlSessionGroup[]> {
    return this.urlSessionsService.listGroupedByUrl(
      request.organisationId!,
      request.userId,
      membershipId,
    );
  }

  @Get('day')
  getDay(
    @Query('membershipId') membershipId: string | undefined,
    @Query('date') date: string | undefined,
    @Query('projectId') projectId: string | undefined,
    @Query('untracked') untracked: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<UrlActivityDay> {
    return this.urlSessionsService.getDayGroupedByUrl(
      request.organisationId!,
      request.userId,
      date,
      { projectId: untracked === '1' ? null : projectId },
      membershipId,
    );
  }

  // Deletes every tracked session for one URL, for one member — always
  // admin/manager, with no self-service exception (unlike time-entry
  // editing, there's no "manager can't delete their own" nuance here).
  @Delete()
  @RequireRole(MembershipRole.ADMIN, MembershipRole.MANAGER)
  delete(
    @Query('membershipId') membershipId: string,
    @Query('url') url: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.urlSessionsService.deleteByUrl(
      request.organisationId!,
      request.userId,
      membershipId,
      url,
    );
  }
}
