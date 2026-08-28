import {
  Body,
  Controller,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { LoginDto } from './dto/login.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { SetPasswordDto } from './dto/set-password.dto';

const SIGNUP_THROTTLE_TTL_MS = 15 * 60 * 1000;
const SIGNUP_THROTTLE_LIMIT = 5;
const LOGIN_THROTTLE_TTL_MS = 15 * 60 * 1000;
const LOGIN_THROTTLE_LIMIT = 5;
const RESEND_VERIFICATION_THROTTLE_TTL_MS = 15 * 60 * 1000;
const RESEND_VERIFICATION_THROTTLE_LIMIT = 5;

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

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) response: Response): { message: string } {
    return this.authService.logout(response);
  }
}
