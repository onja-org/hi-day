import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import type { DeviceSummary } from '../services/devices.service';
import { DevicesService } from '../services/devices.service';

@Controller('me/devices')
@UseGuards(JwtAuthGuard)
export class MyDevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest): Promise<DeviceSummary[]> {
    return this.devicesService.listForUser(request.userId);
  }

  @Post(':deviceId/sign-out')
  async signOut(
    @Param('deviceId') deviceId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ device: DeviceSummary; message: string }> {
    const device = await this.devicesService.signOutOwnDevice(
      request.userId,
      deviceId,
    );
    return { device, message: 'Device signed out' };
  }
}
