import {
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type { Response } from 'express';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { EmailService } from '../../email/services/email.service';
import { OrganisationsService } from '../../organisations/services/organisations.service';
import { CreateAccountDto } from '../dto/create-account.dto';
import { LoginDto } from '../dto/login.dto';
import { ResendVerificationDto } from '../dto/resend-verification.dto';
import { SetPasswordDto } from '../dto/set-password.dto';
import { PasswordService } from './password.service';
import { ACCESS_TOKEN_COOKIE, TokenService } from './token.service';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const ACCESS_TOKEN_COOKIE_MAX_AGE_MS = 60 * 60 * 1000;
const SIGNUP_RESPONSE_MESSAGE = 'Check your email to set your password.';
const RESEND_VERIFICATION_RESPONSE_MESSAGE =
  "If that email is awaiting verification, we've sent a new link.";
const INVALID_LOGIN_MESSAGE = 'Invalid email or password.';
const POSTGRES_UNIQUE_VIOLATION = '23505';
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$EdLgXk5ViQoSXTFItKblvQ$/dRGHQlCkWNFJX/M1z2MfiETG+HUWqdGGuZBfni0RRk';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
    private readonly organisationsService: OrganisationsService,
  ) {}

  async signUp(dto: CreateAccountDto): Promise<{ message: string }> {
    const existingUser = await this.users.findOne({
      where: { email: dto.email },
    });

    if (existingUser) {
      await this.emailService.sendDuplicateRegistrationNotice(dto.email);
      return { message: SIGNUP_RESPONSE_MESSAGE };
    }

    const emailVerificationToken =
      this.tokenService.generateEmailVerificationToken();
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
      const emailVerificationToken =
        this.tokenService.generateEmailVerificationToken();
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
      throw new UnprocessableEntityException(
        'This link is invalid or has expired.',
      );
    }

    const passwordHash = await this.passwordService.hash(dto.password);

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
    });

    const accessToken = this.tokenService.signAccessToken(user.id);
    response.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      maxAge: ACCESS_TOKEN_COOKIE_MAX_AGE_MS,
    });

    return { message: 'Password set. You are now signed in.' };
  }

  async login(dto: LoginDto, response: Response): Promise<{ message: string }> {
    const user = await this.users.findOne({ where: { email: dto.email } });

    const passwordMatches = await this.passwordService.verify(
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
      dto.password,
    );

    if (!user || !user.passwordHash || !passwordMatches) {
      throw new UnauthorizedException(INVALID_LOGIN_MESSAGE);
    }

    const accessToken = this.tokenService.signAccessToken(user.id);
    response.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      maxAge: ACCESS_TOKEN_COOKIE_MAX_AGE_MS,
    });

    return { message: 'Logged in.' };
  }

  logout(response: Response): { message: string } {
    response.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    return { message: 'Logged out.' };
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string } | undefined)?.code ===
        POSTGRES_UNIQUE_VIOLATION
    );
  }
}
