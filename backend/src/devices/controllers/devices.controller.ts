import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { ListDevicesDto } from '../dto/list-devices.dto';
import type { DeviceSummary } from '../services/devices.service';
import { DevicesService } from '../services/devices.service';

@Controller('organisations/:id/devices')
@UseGuards(JwtAuthGuard, RoleGuard)
@RequireRole(MembershipRole.ADMIN, MembershipRole.MANAGER)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  list(
    @Query() query: ListDevicesDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<DeviceSummary[]> {
    return this.devicesService.listForOrganisation(
      request.organisationId!,
      request.userId,
      query.userId,
    );
  }

  @Post(':deviceId/sign-out')
  async signOut(
    @Param('deviceId') deviceId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ device: DeviceSummary; message: string }> {
    const device = await this.devicesService.signOutAsAdmin(
      request.organisationId!,
      deviceId,
      request.userId,
    );
    return { device, message: 'Device signed out' };
  }
}
