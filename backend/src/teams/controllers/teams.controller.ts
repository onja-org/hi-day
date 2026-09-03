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
import type { TeamDetail, TeamSummary } from '../services/teams.service';
import { TeamsService } from '../services/teams.service';

@Controller('organisations/:id/teams')
@UseGuards(JwtAuthGuard, RoleGuard)
@RequireRole(MembershipRole.ADMIN)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
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

  @Get(':teamId')
  getDetail(
    @Param('teamId') teamId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<TeamDetail> {
    return this.teamsService.getDetail(request.organisationId!, teamId);
  }

  @Patch(':teamId')
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

  @Post(':teamId/members')
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
