import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { UpdateOrganisationDto } from '../dto/update-organisation.dto';
import type { OrganisationProfile } from '../services/organisations.service';
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
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganisationDto,
  ): Promise<OrganisationProfile> {
    return this.organisationsService.updateProfile(id, dto);
  }
}
