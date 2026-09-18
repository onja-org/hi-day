import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { StartDevicePairingDto } from '../dto/start-device-pairing.dto';
import type {
  DevicePairingPollResult,
  DevicePairingStarted,
  DevicePairingSummary,
} from '../services/device-pairing.service';
import { DevicePairingService } from '../services/device-pairing.service';

const POLL_THROTTLE = { pairing: { limit: 40, ttl: 60 * 1000 } };

@Controller('device-pairing')
export class DevicePairingController {
  constructor(private readonly devicePairingService: DevicePairingService) {}

  /** Public — the desktop app calls this before it has any credentials. */
  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle(POLL_THROTTLE)
  start(@Body() dto: StartDevicePairingDto): Promise<DevicePairingStarted> {
    return this.devicePairingService.start(dto);
  }

  /** Public — the desktop app polls this until it's approved or expires. */
  @Get(':code/status')
  @UseGuards(ThrottlerGuard)
  @Throttle(POLL_THROTTLE)
  status(@Param('code') code: string): Promise<DevicePairingPollResult> {
    return this.devicePairingService.pollStatus(code);
  }

  /** Web app only — shown before the person approves. */
  @Get(':code')
  @UseGuards(JwtAuthGuard)
  get(@Param('code') code: string): Promise<DevicePairingSummary> {
    return this.devicePairingService.getPendingByCode(code);
  }

  /** Web app only — the actual "log this device in" action. */
  @Post(':code/approve')
  @UseGuards(JwtAuthGuard)
  async approve(
    @Param('code') code: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    await this.devicePairingService.approve(code, request.userId);
    return { message: 'Device approved' };
  }
}
