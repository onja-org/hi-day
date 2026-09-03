import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type { Request, Response } from 'express';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { recordAnalyticsEvent } from '../../common/analytics';
import { readCookie } from '../../common/cookies.util';
import { setSessionCookies } from '../../common/session-cookies.util';
import { DeviceSessionService } from '../../devices/services/device-session.service';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { User } from '../../database/entities/user.entity';
import { EmailService } from '../../email/services/email.service';
import { OrganisationsService } from '../../organisations/services/organisations.service';
import { CreateAccountDto } from '../dto/create-account.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { LoginDto } from '../dto/login.dto';
import { ResendVerificationDto } from '../dto/resend-verification.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { SetPasswordDto } from '../dto/set-password.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { CaptchaService } from './captcha.service';
import { LoginAttemptTracker } from './login-attempt-tracker.service';
import { PasswordService } from './password.service';
import { RefreshTokenService } from './refresh-token.service';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  TokenService,
} from './token.service';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const SIGNUP_RESPONSE_MESSAGE = 'Check your email to set your password.';
const RESEND_VERIFICATION_RESPONSE_MESSAGE =
  "If that email is awaiting verification, we've sent a new link.";
const FORGOT_PASSWORD_RESPONSE_MESSAGE =
  "If that email has an account, we've sent a password reset link.";
const INVALID_LOGIN_MESSAGE = 'Invalid email or password.';
const DEACTIVATED_MESSAGE =
  'Your account has been deactivated. Contact an admin of your organisation if you believe this is a mistake.';
const INVALID_OR_EXPIRED_LINK_MESSAGE = 'This link is invalid or has expired.';
const SESSION_EXPIRED_MESSAGE = 'Session expired. Please log in again.';
const POSTGRES_UNIQUE_VIOLATION = '23505';
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$EdLgXk5ViQoSXTFItKblvQ$/dRGHQlCkWNFJX/M1z2MfiETG+HUWqdGGuZBfni0RRk';

export interface UserProfile {
  email: string;
  name: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly emailService: EmailService,
    private readonly organisationsService: OrganisationsService,
    private readonly auditLogService: AuditLogService,
    private readonly loginAttemptTracker: LoginAttemptTracker,
    private readonly captchaService: CaptchaService,
    private readonly deviceSessionService: DeviceSessionService,
  ) {}

  async signUp(dto: CreateAccountDto): Promise<{ message: string }> {
    const existingUser = await this.users.findOne({
      where: { email: dto.email },
    });

    if (existingUser) {
      await this.emailService.sendDuplicateRegistrationNotice(dto.email);
      return { message: SIGNUP_RESPONSE_MESSAGE };
    }

    const emailVerificationToken = this.tokenService.generateToken();
    const emailVerificationExpiresAt = new Date(
      Date.now() + EMAIL_VERIFICATION_TTL_MS,
    );

    const user = await this.users
      .save(
        this.users.create({
          email: dto.email,
          name: `${dto.firstName} ${dto.lastName}`,
          passwordHash: null,
          emailVerificationToken,
          emailVerificationExpiresAt,
          pendingOrganisationName: dto.companyName,
          pendingOrganisationAddress: dto.address,
          pendingOrganisationWebsite: dto.website ?? null,
        }),
      )
      .catch((error: unknown) => {
        if (this.isUniqueViolation(error)) {
          return null;
        }
        throw error;
      });

    if (!user) {
      await this.emailService.sendDuplicateRegistrationNotice(dto.email);
      return { message: SIGNUP_RESPONSE_MESSAGE };
    }

    await this.emailService.sendSetPasswordEmail(
      dto.email,
      emailVerificationToken,
    );

    return { message: SIGNUP_RESPONSE_MESSAGE };
  }

  async resendVerificationEmail(
    dto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    const user = await this.users.findOne({ where: { email: dto.email } });

    if (user && !user.passwordHash) {
      const emailVerificationToken = this.tokenService.generateToken();
      const emailVerificationExpiresAt = new Date(
        Date.now() + EMAIL_VERIFICATION_TTL_MS,
      );

      await this.users.update(user.id, {
        emailVerificationToken,
        emailVerificationExpiresAt,
      });

      await this.emailService.sendSetPasswordEmail(
        dto.email,
        emailVerificationToken,
      );
    }

    return { message: RESEND_VERIFICATION_RESPONSE_MESSAGE };
  }

  async setPassword(
    dto: SetPasswordDto,
    response: Response,
  ): Promise<{ message: string }> {
    const user = await this.users.findOne({
      where: { emailVerificationToken: dto.token },
    });

    if (
      !user ||
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt < new Date()
    ) {
      throw new UnprocessableEntityException(INVALID_OR_EXPIRED_LINK_MESSAGE);
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    let refreshToken = '';

    await this.dataSource.transaction(async (manager) => {
      await manager.update(User, user.id, {
        passwordHash,
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
        pendingOrganisationName: null,
        pendingOrganisationAddress: null,
        pendingOrganisationWebsite: null,
      });

      await this.organisationsService.createForUser(manager, user.id, {
        name: user.pendingOrganisationName!,
        address: user.pendingOrganisationAddress,
        website: user.pendingOrganisationWebsite,
      });

      refreshToken = await this.refreshTokenService.issue(manager, user.id);
    });

    const accessToken = this.tokenService.signAccessToken(user.id);
    setSessionCookies(response, accessToken, refreshToken, this.configService);

    return { message: 'Password set. You are now signed in.' };
  }

  async login(
    dto: LoginDto,
    response: Response,
  ): Promise<{ message: string; deviceId?: string; deviceToken?: string }> {
    if (this.loginAttemptTracker.requiresCaptcha(dto.email)) {
      const captchaValid = await this.captchaService.verify(dto.captchaToken);

      if (!captchaValid) {
        recordAnalyticsEvent('login_failed', { email: dto.email });
        throw new UnauthorizedException({
          message: INVALID_LOGIN_MESSAGE,
          captchaRequired: true,
        });
      }
    }

    const user = await this.users.findOne({ where: { email: dto.email } });

    const passwordMatches = await this.passwordService.verify(
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
      dto.password,
    );

    if (!user || !user.passwordHash || !passwordMatches) {
      this.loginAttemptTracker.recordFailure(dto.email);
      recordAnalyticsEvent('login_failed', { email: dto.email });
      throw new UnauthorizedException({
        message: INVALID_LOGIN_MESSAGE,
        captchaRequired: this.loginAttemptTracker.requiresCaptcha(dto.email),
      });
    }

    this.loginAttemptTracker.reset(dto.email);

    const hasActiveMembership = await this.memberships.exists({
      where: { userId: user.id, status: MembershipStatus.ACTIVE },
    });

    if (!hasActiveMembership) {
      recordAnalyticsEvent('login_blocked_deactivated', { userId: user.id });
      throw new ForbiddenException(DEACTIVATED_MESSAGE);
    }

    if (dto.deviceFingerprint) {
      const activeMembership = await this.memberships.findOne({
        where: { userId: user.id, status: MembershipStatus.ACTIVE },
      });

      const { deviceId, token: deviceToken } =
        await this.dataSource.transaction((manager) =>
          this.deviceSessionService.upsertOnLogin(manager, {
            userId: user.id,
            organisationId: activeMembership!.organisationId,
            deviceFingerprint: dto.deviceFingerprint!,
            platform: dto.platform!,
            osVersion: dto.osVersion,
            hostname: dto.hostname,
            appVersion: dto.appVersion,
          }),
        );

      await this.auditLogService.record(this.dataSource.manager, {
        action: 'login',
        actorUserId: user.id,
      });
      recordAnalyticsEvent('login_succeeded', { userId: user.id });

      return { message: 'Logged in.', deviceId, deviceToken };
    }

    const accessToken = this.tokenService.signAccessToken(user.id);
    const refreshToken = await this.refreshTokenService.issue(
      this.dataSource.manager,
      user.id,
    );
    setSessionCookies(response, accessToken, refreshToken, this.configService);

    await this.auditLogService.record(this.dataSource.manager, {
      action: 'login',
      actorUserId: user.id,
    });
    recordAnalyticsEvent('login_succeeded', { userId: user.id });

    return { message: 'Logged in.' };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.users.findOne({ where: { email: dto.email } });

    if (user?.passwordHash) {
      const passwordResetToken = this.tokenService.generateToken();
      const passwordResetExpiresAt = new Date(
        Date.now() + PASSWORD_RESET_TTL_MS,
      );

      await this.users.update(user.id, {
        passwordResetToken,
        passwordResetExpiresAt,
      });

      await this.emailService.sendPasswordResetEmail(
        dto.email,
        passwordResetToken,
      );
    } else if (user && !user.passwordHash) {
      const emailVerificationToken = this.tokenService.generateToken();
      const emailVerificationExpiresAt = new Date(
        Date.now() + EMAIL_VERIFICATION_TTL_MS,
      );

      await this.users.update(user.id, {
        emailVerificationToken,
        emailVerificationExpiresAt,
      });

      await this.emailService.sendSetPasswordEmail(
        dto.email,
        emailVerificationToken,
      );
    }

    return { message: FORGOT_PASSWORD_RESPONSE_MESSAGE };
  }

  async resetPassword(
    dto: ResetPasswordDto,
    response: Response,
  ): Promise<{ message: string }> {
    const user = await this.users.findOne({
      where: { passwordResetToken: dto.token },
    });

    if (
      !user ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt < new Date()
    ) {
      throw new UnprocessableEntityException(INVALID_OR_EXPIRED_LINK_MESSAGE);
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    let refreshToken = '';

    await this.dataSource.transaction(async (manager) => {
      await manager.update(User, user.id, {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      });

      await this.refreshTokenService.revokeAll(manager, user.id);
      refreshToken = await this.refreshTokenService.issue(manager, user.id);

      await this.auditLogService.record(manager, {
        action: 'password_reset',
        actorUserId: user.id,
      });
    });

    const accessToken = this.tokenService.signAccessToken(user.id);
    setSessionCookies(response, accessToken, refreshToken, this.configService);
    recordAnalyticsEvent('password_reset_completed', { userId: user.id });

    return { message: 'Password reset. You are now signed in.' };
  }

  async refresh(
    request: Request,
    response: Response,
  ): Promise<{ message: string }> {
    const presentedToken = readCookie(request, REFRESH_TOKEN_COOKIE);

    if (!presentedToken) {
      throw new UnauthorizedException(SESSION_EXPIRED_MESSAGE);
    }

    const { userId, token: refreshToken } = await this.dataSource.transaction(
      (manager) => this.refreshTokenService.rotate(manager, presentedToken),
    );

    const accessToken = this.tokenService.signAccessToken(userId);
    setSessionCookies(response, accessToken, refreshToken, this.configService);

    return { message: 'Session refreshed.' };
  }

  async logout(
    request: Request,
    response: Response,
  ): Promise<{ message: string }> {
    const refreshToken = readCookie(request, REFRESH_TOKEN_COOKIE);

    if (refreshToken) {
      await this.refreshTokenService.revokeByValue(
        this.dataSource.manager,
        refreshToken,
      );
    }

    response.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    response.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });

    return { message: 'Logged out.' };
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.users.findOneOrFail({ where: { id: userId } });
    return { email: user.email, name: user.name };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserProfile> {
    await this.users.update(userId, { name: dto.name });
    return this.getProfile(userId);
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string } | undefined)?.code ===
        POSTGRES_UNIQUE_VIOLATION
    );
  }
}
