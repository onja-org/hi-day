import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { AddTeamMemberDto } from '../dto/add-team-member.dto';
import { CreateTeamDto } from '../dto/create-team.dto';
import { UpdateTeamDto } from '../dto/update-team.dto';
import { TeamRoleGuard } from '../guards/team-role.guard';
import { TeamViewGuard } from '../guards/team-view.guard';
import type { TeamDetail, TeamSummary } from '../services/teams.service';
import { TeamsService } from '../services/teams.service';

@Controller('organisations/:id/teams')
@UseGuards(JwtAuthGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  // Creating, renaming, and deleting a team are org-wide operations (no
  // existing team to be a manager of yet, or too consequential to delegate)
  // — stay admin-only.
  @Post()
  @UseGuards(RoleGuard)
  @RequireRole(MembershipRole.ADMIN)
  create(
    @Body() dto: CreateTeamDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<TeamSummary> {
    return this.teamsService.create(
      request.organisationId!,
      request.userId,
      dto,
    );
  }

  @Patch(':teamId')
  @UseGuards(RoleGuard)
  @RequireRole(MembershipRole.ADMIN)
  update(
    @Param('teamId') teamId: string,
    @Body() dto: UpdateTeamDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<TeamSummary> {
    return this.teamsService.update(
      request.organisationId!,
      teamId,
      request.userId,
      dto,
    );
  }

  @Delete(':teamId')
  @UseGuards(RoleGuard)
  @RequireRole(MembershipRole.ADMIN)
  remove(
    @Param('teamId') teamId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.teamsService.remove(
      request.organisationId!,
      teamId,
      request.userId,
    );
  }

  // Read-only: an org admin, or anyone holding a team_memberships row on
  // this team (manager or plain member), can view it — see TeamViewGuard.
  @Get(':teamId')
  @UseGuards(TeamViewGuard)
  getDetail(
    @Param('teamId') teamId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<TeamDetail> {
    return this.teamsService.getDetail(request.organisationId!, teamId);
  }

  // Mutating: an org admin can always manage this team's membership, and
  // so can that team's own manager(s), even if their org role is plain
  // "member" or "manager" of no other team. See TeamRoleGuard.
  @Post(':teamId/members')
  @UseGuards(TeamRoleGuard)
  addOrUpdateMember(
    @Param('teamId') teamId: string,
    @Body() dto: AddTeamMemberDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.teamsService.addOrUpdateMember(
      request.organisationId!,
      teamId,
      request.userId,
      dto,
    );
  }

  @Delete(':teamId/members/:membershipId')
  @UseGuards(TeamRoleGuard)
  removeMember(
    @Param('teamId') teamId: string,
    @Param('membershipId') membershipId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.teamsService.removeMember(
      request.organisationId!,
      teamId,
      membershipId,
      request.userId,
    );
  }
}
