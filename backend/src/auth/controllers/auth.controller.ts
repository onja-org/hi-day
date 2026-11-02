import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../jwt-auth.guard';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { AuthService, UserProfile } from '../services/auth.service';
import { CreateAccountDto } from '../dto/create-account.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { LoginDto } from '../dto/login.dto';
import { ResendVerificationDto } from '../dto/resend-verification.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { SetPasswordDto } from '../dto/set-password.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';

const THROTTLE_TTL_MS = 15 * 60 * 1000;

// `default` is per-IP, which behind the proxy means one bucket for everyone,
// so it is sized as a global ceiling. The per-caller limits are the named
// throttlers below. See common/throttler-trackers.util.ts.
const GLOBAL_SIGNUP_THROTTLE_LIMIT = 200;
const GLOBAL_LOGIN_THROTTLE_LIMIT = 600;
const GLOBAL_EMAIL_SEND_THROTTLE_LIMIT = 200;
const GLOBAL_REFRESH_THROTTLE_LIMIT = 2000;

const PER_EMAIL_SIGNUP_THROTTLE_LIMIT = 5;
const PER_EMAIL_SEND_THROTTLE_LIMIT = 5;
const PER_EMAIL_THROTTLE_BLOCK_DURATION_MS = 45 * 60 * 1000;
const PER_TOKEN_RESET_THROTTLE_LIMIT = 10;
// Per browser session, so one dead refresh token throttles only its own
// browser rather than everybody's.
const PER_SESSION_REFRESH_THROTTLE_LIMIT = 20;

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: { limit: GLOBAL_SIGNUP_THROTTLE_LIMIT, ttl: THROTTLE_TTL_MS },
    email: { limit: PER_EMAIL_SIGNUP_THROTTLE_LIMIT, ttl: THROTTLE_TTL_MS },
  })
  @SkipThrottle({ session: true, token: true })
  @HttpCode(201)
  signUp(@Body() dto: CreateAccountDto): Promise<{ message: string }> {
    return this.authService.signUp(dto);
  }

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: { limit: GLOBAL_LOGIN_THROTTLE_LIMIT, ttl: THROTTLE_TTL_MS },
  })
  // The per-email lockout is LoginAttemptTracker + captcha (see
  // AuthService.login), which a throttle must not block once verified.
  @SkipThrottle({ email: true, session: true, token: true })
  @HttpCode(200)
  login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string; deviceId?: string; deviceToken?: string }> {
    return this.authService.login(dto, response);
  }

  @Post('resend-verification')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: { limit: GLOBAL_EMAIL_SEND_THROTTLE_LIMIT, ttl: THROTTLE_TTL_MS },
    email: { limit: PER_EMAIL_SEND_THROTTLE_LIMIT, ttl: THROTTLE_TTL_MS },
  })
  @SkipThrottle({ session: true, token: true })
  @HttpCode(200)
  resendVerification(
    @Body() dto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    return this.authService.resendVerificationEmail(dto);
  }

  @Post('set-password')
  setPassword(
    @Body() dto: SetPasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    return this.authService.setPassword(dto, response);
  }

  @Post('password/forgot')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: { limit: GLOBAL_EMAIL_SEND_THROTTLE_LIMIT, ttl: THROTTLE_TTL_MS },
    email: {
      limit: PER_EMAIL_SEND_THROTTLE_LIMIT,
      ttl: THROTTLE_TTL_MS,
      blockDuration: PER_EMAIL_THROTTLE_BLOCK_DURATION_MS,
    },
  })
  @SkipThrottle({ session: true, token: true })
  @HttpCode(200)
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    return this.authService.forgotPassword(dto);
  }

  @Post('password/reset')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: { limit: GLOBAL_EMAIL_SEND_THROTTLE_LIMIT, ttl: THROTTLE_TTL_MS },
    token: { limit: PER_TOKEN_RESET_THROTTLE_LIMIT, ttl: THROTTLE_TTL_MS },
  })
  @SkipThrottle({ email: true, session: true })
  @HttpCode(200)
  resetPassword(
    @Body() dto: ResetPasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    return this.authService.resetPassword(dto, response);
  }

  @Post('refresh')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: { limit: GLOBAL_REFRESH_THROTTLE_LIMIT, ttl: THROTTLE_TTL_MS },
    session: {
      limit: PER_SESSION_REFRESH_THROTTLE_LIMIT,
      ttl: THROTTLE_TTL_MS,
    },
  })
  @SkipThrottle({ email: true, token: true })
  @HttpCode(200)
  refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    return this.authService.refresh(request, response);
  }

  @Post('logout')
  @HttpCode(200)
  logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    return this.authService.logout(request, response);
  }

  @Post('logout-everywhere')
  @HttpCode(200)
  logoutEverywhere(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    return this.authService.logoutEverywhere(request, response);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() request: AuthenticatedRequest): Promise<UserProfile> {
    return this.authService.getProfile(request.userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Body() dto: UpdateProfileDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ profile: UserProfile; message: string }> {
    const profile = await this.authService.updateProfile(request.userId, dto);
    return { profile, message: 'Profile updated' };
  }
}
