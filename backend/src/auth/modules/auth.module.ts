import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Request } from 'express';
import { AuditLogModule } from '../../audit-log/modules/audit-log.module';
import { Membership } from '../../database/entities/membership.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { User } from '../../database/entities/user.entity';
import { EmailModule } from '../../email/modules/email.module';
import { OrganisationsModule } from '../../organisations/modules/organisations.module';
import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../services/auth.service';
import { CaptchaService } from '../services/captcha.service';
import { LoginAttemptTracker } from '../services/login-attempt-tracker.service';
import { PasswordService } from '../services/password.service';
import { RefreshTokenService } from '../services/refresh-token.service';
import { TokenService } from '../services/token.service';
import { JwtAuthModule } from './jwt-auth.module';

function emailTracker(req: Request): string {
  const email = (req.body as { email?: unknown } | undefined)?.email;
  return typeof email === 'string' && email.length > 0
    ? email.trim().toLowerCase()
    : (req.ip ?? '');
}

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken, Membership]),
    EmailModule,
    OrganisationsModule,
    AuditLogModule,
    JwtAuthModule,
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 15 * 60 * 1000, limit: 5 },
      {
        name: 'email',
        ttl: 15 * 60 * 1000,
        limit: 5,
        blockDuration: 45 * 60 * 1000,
        getTracker: emailTracker,
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    RefreshTokenService,
    LoginAttemptTracker,
    CaptchaService,
  ],
  exports: [PasswordService, TokenService, RefreshTokenService],
})
export class AuthModule {}
