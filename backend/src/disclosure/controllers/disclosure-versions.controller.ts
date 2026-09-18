import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import type { DisclosureVersion } from '../../database/entities/disclosure-version.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { UpdateDisclosureDraftDto } from '../dto/update-disclosure-draft.dto';
import type { DisclosureVersionSummary } from '../services/disclosure.service';
import { DisclosureService } from '../services/disclosure.service';

/**
 * Admin-only draft/publish/history surface for disclosure text — see
 * docs/adr/0014-.... The desktop agent's own read/submit surface lives
 * separately on DeviceTrackingController (`GET /device/disclosure`,
 * `POST /device/consent`), authenticated by device bearer token rather
 * than an admin's JWT+cookie.
 */
@Controller('organisations/:id/disclosure-versions')
@UseGuards(JwtAuthGuard, RoleGuard)
@RequireRole(MembershipRole.ADMIN)
export class DisclosureVersionsController {
  constructor(private readonly disclosureService: DisclosureService) {}

  @Get('draft')
  getDraft(
    @Query('region') region: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<DisclosureVersion> {
    return this.disclosureService.getOrCreateDraft(
      request.organisationId!,
      region,
    );
  }

  @Patch('draft')
  async updateDraft(
    @Query('region') region: string | undefined,
    @Body() dto: UpdateDisclosureDraftDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ draft: DisclosureVersion; message: string }> {
    const draft = await this.disclosureService.updateDraft(
      request.organisationId!,
      region,
      dto.text,
    );
    return { draft, message: 'Disclosure draft updated' };
  }

  @Post('publish')
  async publish(
    @Query('region') region: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ version: DisclosureVersion; message: string }> {
    const membership = await this.disclosureService.resolveActiveMembership(
      request.organisationId!,
      request.userId,
    );
    const version = await this.disclosureService.publish(
      request.organisationId!,
      region,
      membership.id,
      request.userId,
    );
    return { version, message: 'Disclosure version published' };
  }

  @Get()
  listPublished(
    @Query('region') region: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<DisclosureVersionSummary[]> {
    return this.disclosureService.listPublished(
      request.organisationId!,
      region,
    );
  }
}
