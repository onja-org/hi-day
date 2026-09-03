import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { DeviceAuthenticatedRequest } from '../device-session.guard';
import { DeviceSessionGuard } from '../device-session.guard';
import { HeartbeatDto } from '../dto/heartbeat.dto';
import { DeviceSessionService } from '../services/device-session.service';

@Controller('devices')
@UseGuards(DeviceSessionGuard)
export class DeviceSessionController {
  constructor(private readonly deviceSessionService: DeviceSessionService) {}

  @Post('heartbeat')
  heartbeat(
    @Body() dto: HeartbeatDto,
    @Req() request: DeviceAuthenticatedRequest,
  ): Promise<void> {
    return this.deviceSessionService.heartbeat(request.deviceId, dto);
  }

  @Post('logout')
  logout(@Req() request: DeviceAuthenticatedRequest): Promise<void> {
    return this.deviceSessionService.signOutSession(request.deviceSessionId);
  }
}
