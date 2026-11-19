import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../jwt-auth.guard';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { TwoFactorCodeDto } from '../dto/two-factor-code.dto';
import { AuthService } from '../services/auth.service';
import type {
  TwoFactorSetup,
  TwoFactorStatus,
} from '../services/two-factor.service';
import { TwoFactorService } from '../services/two-factor.service';

const THROTTLE_TTL_MS = 15 * 60 * 1000;
// Wrong codes are limited per account by LoginAttemptTracker; this only
// caps how hard one browser can hit these routes at all.
const PER_SESSION_THROTTLE_LIMIT = 30;
const GLOBAL_THROTTLE_LIMIT = 2000;

/**
 * A person's own two-step login, from their account page. Everything that
 * weakens or replaces it asks for a current code first (`TwoFactorService`).
 * An admin's reset for someone else lives with the other member actions in
 * `MembershipsController`.
 */
@Controller('auth/two-factor')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
@Throttle({
  default: { limit: GLOBAL_THROTTLE_LIMIT, ttl: THROTTLE_TTL_MS },
  session: { limit: PER_SESSION_THROTTLE_LIMIT, ttl: THROTTLE_TTL_MS },
})
@SkipThrottle({ email: true, token: true })
export class TwoFactorController {
  constructor(
    private readonly twoFactorService: TwoFactorService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  @SkipThrottle()
  getStatus(@Req() request: AuthenticatedRequest): Promise<TwoFactorStatus> {
    return this.twoFactorService.getStatus(request.userId);
  }

  @Post('setup')
  @HttpCode(200)
  beginSetup(@Req() request: AuthenticatedRequest): Promise<TwoFactorSetup> {
    return this.twoFactorService.beginSetup(request.userId);
  }

  @Post('enable')
  @HttpCode(200)
  async enable(
    @Body() dto: TwoFactorCodeDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ recoveryCodes: string[]; message: string }> {
    const recoveryCodes = await this.twoFactorService.confirmSetup(
      request.userId,
      dto.code,
    );
    await this.authService.restartWebSession(request.userId, response);
    return {
      recoveryCodes,
      message: 'Two-step login is on. Other browsers have been signed out.',
    };
  }

  @Post('disable')
  @HttpCode(200)
  async disable(
    @Body() dto: TwoFactorCodeDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    await this.twoFactorService.disable(request.userId, dto.code);
    await this.authService.restartWebSession(request.userId, response);
    return {
      message: 'Two-step login is off. Other browsers have been signed out.',
    };
  }

  @Post('recovery-codes')
  @HttpCode(200)
  async renewRecoveryCodes(
    @Body() dto: TwoFactorCodeDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ recoveryCodes: string[]; message: string }> {
    const recoveryCodes = await this.twoFactorService.renewRecoveryCodes(
      request.userId,
      dto.code,
    );
    return {
      recoveryCodes,
      message: 'New recovery codes created. The old ones no longer work.',
    };
  }
}
