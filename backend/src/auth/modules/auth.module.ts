import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../../audit-log/modules/audit-log.module';
import { DevicesModule } from '../../devices/modules/devices.module';
import { Membership } from '../../database/entities/membership.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { User } from '../../database/entities/user.entity';
import { EmailModule } from '../../email/modules/email.module';
import { OrganisationsModule } from '../../organisations/modules/organisations.module';
import { TimeEntriesModule } from '../../time-entries/modules/time-entries.module';
import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../services/auth.service';
import { CaptchaService } from '../services/captcha.service';
import { LoginAttemptTracker } from '../services/login-attempt-tracker.service';
import { PasswordService } from '../services/password.service';
import { RefreshTokenService } from '../services/refresh-token.service';
import { TokenService } from '../services/token.service';
import {
  bodyTokenTracker,
  emailTracker,
  sessionTracker,
} from '../../common/throttler-trackers.util';
import { JwtAuthModule } from './jwt-auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken, Membership]),
    EmailModule,
    OrganisationsModule,
    AuditLogModule,
    JwtAuthModule,
    DevicesModule,
    TimeEntriesModule,
    // `default` stays per-IP, which behind the proxy makes it a global
    // ceiling; the named ones are per-actor. See throttler-trackers.util.ts.
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 15 * 60 * 1000, limit: 200 },
      {
        name: 'email',
        ttl: 15 * 60 * 1000,
        limit: 5,
        blockDuration: 45 * 60 * 1000,
        getTracker: emailTracker,
      },
      {
        name: 'session',
        ttl: 15 * 60 * 1000,
        limit: 20,
        getTracker: sessionTracker,
      },
      {
        name: 'token',
        ttl: 15 * 60 * 1000,
        limit: 10,
        getTracker: bodyTokenTracker,
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
  exports: [AuthService, PasswordService, TokenService, RefreshTokenService],
})
export class AuthModule {}
