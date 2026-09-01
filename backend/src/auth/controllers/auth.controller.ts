import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { CreateAccountDto } from '../dto/create-account.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { LoginDto } from '../dto/login.dto';
import { ResendVerificationDto } from '../dto/resend-verification.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { SetPasswordDto } from '../dto/set-password.dto';

const SIGNUP_THROTTLE_TTL_MS = 15 * 60 * 1000;
const SIGNUP_THROTTLE_LIMIT = 5;
const LOGIN_THROTTLE_TTL_MS = 15 * 60 * 1000;
const LOGIN_THROTTLE_LIMIT = 5;
const LOGIN_EMAIL_THROTTLE_BLOCK_DURATION_MS = 45 * 60 * 1000;
const RESEND_VERIFICATION_THROTTLE_TTL_MS = 15 * 60 * 1000;
const RESEND_VERIFICATION_THROTTLE_LIMIT = 5;
const REFRESH_THROTTLE_TTL_MS = 15 * 60 * 1000;
const REFRESH_THROTTLE_LIMIT = 20;

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: { limit: SIGNUP_THROTTLE_LIMIT, ttl: SIGNUP_THROTTLE_TTL_MS },
  })
  @HttpCode(201)
  signUp(@Body() dto: CreateAccountDto): Promise<{ message: string }> {
    return this.authService.signUp(dto);
  }

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: { limit: LOGIN_THROTTLE_LIMIT, ttl: LOGIN_THROTTLE_TTL_MS },
    email: {
      limit: LOGIN_THROTTLE_LIMIT,
      ttl: LOGIN_THROTTLE_TTL_MS,
      blockDuration: LOGIN_EMAIL_THROTTLE_BLOCK_DURATION_MS,
    },
  })
  @HttpCode(200)
  login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    return this.authService.login(dto, response);
  }

  @Post('resend-verification')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: RESEND_VERIFICATION_THROTTLE_LIMIT,
      ttl: RESEND_VERIFICATION_THROTTLE_TTL_MS,
    },
  })
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
    default: {
      limit: RESEND_VERIFICATION_THROTTLE_LIMIT,
      ttl: RESEND_VERIFICATION_THROTTLE_TTL_MS,
    },
    email: {
      limit: RESEND_VERIFICATION_THROTTLE_LIMIT,
      ttl: RESEND_VERIFICATION_THROTTLE_TTL_MS,
      blockDuration: LOGIN_EMAIL_THROTTLE_BLOCK_DURATION_MS,
    },
  })
  @HttpCode(200)
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    return this.authService.forgotPassword(dto);
  }

  @Post('password/reset')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: { limit: SIGNUP_THROTTLE_LIMIT, ttl: SIGNUP_THROTTLE_TTL_MS },
  })
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
    default: { limit: REFRESH_THROTTLE_LIMIT, ttl: REFRESH_THROTTLE_TTL_MS },
  })
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
}
