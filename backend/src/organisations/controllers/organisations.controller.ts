import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { UpdateOrganisationDto } from '../dto/update-organisation.dto';
import type {
  OrganisationProfile,
  TeamOverview,
} from '../services/organisations.service';
import { OrganisationsService } from '../services/organisations.service';

@Controller('organisations')
@UseGuards(JwtAuthGuard)
export class OrganisationsController {
  constructor(private readonly organisationsService: OrganisationsService) {}

  @Get('current')
  getCurrent(
    @Req() request: AuthenticatedRequest,
  ): Promise<OrganisationProfile> {
    return this.organisationsService.findCurrentForUser(request.userId);
  }

  @Patch(':id')
  @UseGuards(RoleGuard)
  @RequireRole(MembershipRole.ADMIN)
  async update(
    @Body() dto: UpdateOrganisationDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ organisation: OrganisationProfile; message: string }> {
    const organisation = await this.organisationsService.updateProfile(
      request.organisationId!,
      request.userId,
      dto,
    );
    return { organisation, message: 'Organisation updated' };
  }

  @Get(':id/teams')
  @UseGuards(RoleGuard)
  @RequireRole(
    MembershipRole.ADMIN,
    MembershipRole.MANAGER,
    MembershipRole.MEMBER,
    MembershipRole.FINANCE,
  )
  listTeams(@Req() request: AuthenticatedRequest): Promise<TeamOverview[]> {
    return this.organisationsService.listTeams(
      request.organisationId!,
      request.userId,
    );
  }
}
