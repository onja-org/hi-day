import {
  ForbiddenException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { AuditLogService } from '../../../audit-log/services/audit-log.service';
import { DeviceSessionService } from '../../../devices/services/device-session.service';
import { DevicePlatform } from '../../../database/entities/device-platform.enum';
import { Membership } from '../../../database/entities/membership.entity';
import { User } from '../../../database/entities/user.entity';
import { EmailService } from '../../../email/services/email.service';
import { OrganisationsService } from '../../../organisations/services/organisations.service';
import { AuthService } from '../auth.service';
import { CaptchaService } from '../captcha.service';
import { LoginAttemptTracker } from '../login-attempt-tracker.service';
import { PasswordService } from '../password.service';
import { RefreshTokenService } from '../refresh-token.service';
import { TokenService } from '../token.service';

describe('AuthService', () => {
  function makeUsersRepo(overrides: Partial<Repository<User>> = {}) {
    return {
      findOne: jest.fn(),
      update: jest.fn(),
      create: jest.fn((data: Partial<User>) => data),
      save: jest.fn(),
      ...overrides,
    } as unknown as Repository<User>;
  }

  function makeMembershipsRepo(
    overrides: Partial<Repository<Membership>> = {},
  ) {
    return {
      exists: jest.fn().mockResolvedValue(true),
      findOne: jest.fn().mockResolvedValue({ organisationId: 'org-1' }),
      ...overrides,
    } as unknown as Repository<Membership>;
  }

  function makeDataSource() {
    const manager = { update: jest.fn() } as unknown as EntityManager;
    const transaction = jest.fn(
      (fn: (manager: EntityManager) => Promise<unknown>) => fn(manager),
    );
    return {
      dataSource: { transaction, manager } as unknown,
      manager,
      transaction,
    };
  }

  function makeConfigService() {
    return { get: jest.fn() } as unknown as ConfigService;
  }

  function makePasswordService(overrides: Partial<PasswordService> = {}) {
    return {
      hash: jest.fn().mockResolvedValue('hashed-password'),
      verify: jest.fn().mockResolvedValue(false),
      ...overrides,
    };
  }

  function makeTokenService(overrides: Partial<TokenService> = {}) {
    return {
      generateToken: jest.fn().mockReturnValue('the-token'),
      signAccessToken: jest.fn().mockReturnValue('signed.jwt.token'),
      ...overrides,
    } as unknown as TokenService;
  }

  function makeRefreshTokenService() {
    const issue = jest.fn().mockResolvedValue('the-refresh-token');
    const rotate = jest.fn().mockResolvedValue({
      userId: 'user-1',
      token: 'rotated-refresh-token',
    });
    const revokeAll = jest.fn().mockResolvedValue(undefined);
    const revokeByValue = jest.fn().mockResolvedValue(undefined);
    return {
      refreshTokenService: {
        issue,
        rotate,
        revokeAll,
        revokeByValue,
      } as unknown as RefreshTokenService,
      issue,
      rotate,
      revokeAll,
      revokeByValue,
    };
  }

  function makeAuditLogService() {
    const record = jest.fn().mockResolvedValue(undefined);
    return {
      auditLogService: { record } as unknown as AuditLogService,
      record,
    };
  }

  function makeEmailService() {
    const sendSetPasswordEmail = jest.fn().mockResolvedValue(undefined);
    const sendDuplicateRegistrationNotice = jest
      .fn()
      .mockResolvedValue(undefined);
    const sendPasswordResetEmail = jest.fn().mockResolvedValue(undefined);
    const emailService = {
      sendSetPasswordEmail,
      sendDuplicateRegistrationNotice,
      sendPasswordResetEmail,
    } as unknown as EmailService;
    return {
      emailService,
      sendSetPasswordEmail,
      sendDuplicateRegistrationNotice,
      sendPasswordResetEmail,
    };
  }

  function makeLoginAttemptTracker() {
    const requiresCaptcha = jest.fn().mockReturnValue(false);
    const recordFailure = jest.fn();
    const reset = jest.fn();
    return {
      loginAttemptTracker: {
        requiresCaptcha,
        recordFailure,
        reset,
      } as unknown as LoginAttemptTracker,
      requiresCaptcha,
      recordFailure,
      reset,
    };
  }

  function makeCaptchaService() {
    const verify = jest.fn().mockResolvedValue(true);
    return {
      captchaService: { verify } as unknown as CaptchaService,
      verify,
    };
  }

  function makeDeviceSessionService() {
    const upsertOnLogin = jest
      .fn()
      .mockResolvedValue({ deviceId: 'device-1', token: 'device-token' });
    return {
      deviceSessionService: {
        upsertOnLogin,
      } as unknown as DeviceSessionService,
      upsertOnLogin,
    };
  }

  function makeOrganisationsService() {
    const createForUser = jest.fn().mockResolvedValue({ id: 'org-1' });
    return {
      organisationsService: {
        createForUser,
      } as unknown as OrganisationsService,
      createForUser,
    };
  }

  function makeResponse() {
    const cookie = jest.fn();
    const clearCookie = jest.fn();
    return {
      response: { cookie, clearCookie } as unknown as Response,
      cookie,
      clearCookie,
    };
  }

  function makeRequest(cookieHeader?: string) {
    return {
      headers: { cookie: cookieHeader },
    } as unknown as Request;
  }

  function makeService(
    overrides: {
      usersRepo?: Repository<User>;
      membershipsRepo?: Repository<Membership>;
      dataSource?: unknown;
      configService?: ConfigService;
      passwordService?: Partial<PasswordService>;
      tokenService?: TokenService;
      refreshTokenService?: RefreshTokenService;
      emailService?: EmailService;
      organisationsService?: OrganisationsService;
      auditLogService?: AuditLogService;
      loginAttemptTracker?: LoginAttemptTracker;
      captchaService?: CaptchaService;
      deviceSessionService?: DeviceSessionService;
    } = {},
  ) {
    return new AuthService(
      overrides.usersRepo ?? makeUsersRepo(),
      overrides.membershipsRepo ?? makeMembershipsRepo(),
      (overrides.dataSource ?? makeDataSource().dataSource) as never,
      overrides.configService ?? makeConfigService(),
      (overrides.passwordService ?? makePasswordService()) as PasswordService,
      overrides.tokenService ?? makeTokenService(),
      overrides.refreshTokenService ??
        makeRefreshTokenService().refreshTokenService,
      overrides.emailService ?? makeEmailService().emailService,
      overrides.organisationsService ??
        makeOrganisationsService().organisationsService,
      overrides.auditLogService ?? makeAuditLogService().auditLogService,
      overrides.loginAttemptTracker ??
        makeLoginAttemptTracker().loginAttemptTracker,
      overrides.captchaService ?? makeCaptchaService().captchaService,
      overrides.deviceSessionService ??
        makeDeviceSessionService().deviceSessionService,
    );
  }

  const signUpInput = {
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@acme.test',
    companyName: 'Acme Inc',
    address: '1 Main St',
  };

  describe('signUp', () => {
    it('creates the user with no password, stashes the pending org fields, and emails a set-password link', async () => {
      const create = jest.fn((data: Partial<User>) => data);
      const save = jest.fn().mockResolvedValue({ id: 'user-1' });
      const usersRepo = makeUsersRepo({
        findOne: jest.fn().mockResolvedValue(null),
        create,
        save,
      });
      const { emailService, sendSetPasswordEmail } = makeEmailService();
      const service = makeService({ usersRepo, emailService });

      const result = await service.signUp(signUpInput);

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'jane@acme.test',
          name: 'Jane Doe',
          passwordHash: null,
          pendingOrganisationName: 'Acme Inc',
          pendingOrganisationAddress: '1 Main St',
          pendingOrganisationWebsite: null,
        }),
      );
      expect(sendSetPasswordEmail).toHaveBeenCalledWith(
        'jane@acme.test',
        'the-token',
      );
      expect(result.message).toContain('Check your email');
    });

    it('sends a duplicate-registration notice without creating a second user', async () => {
      const save = jest.fn();
      const usersRepo = makeUsersRepo({
        findOne: jest.fn().mockResolvedValue({ id: 'existing-user' }),
        save,
      });
      const { emailService, sendDuplicateRegistrationNotice } =
        makeEmailService();
      const service = makeService({ usersRepo, emailService });

      await service.signUp(signUpInput);

      expect(save).not.toHaveBeenCalled();
      expect(sendDuplicateRegistrationNotice).toHaveBeenCalledWith(
        'jane@acme.test',
      );
    });

    it('treats a unique-constraint violation on save as a duplicate registration', async () => {
      const uniqueViolation = Object.assign(
        new QueryFailedError('insert', [], new Error('duplicate key')),
        { driverError: { code: '23505' } },
      );
      const usersRepo = makeUsersRepo({
        findOne: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockRejectedValue(uniqueViolation),
      });
      const { emailService, sendDuplicateRegistrationNotice } =
        makeEmailService();
      const service = makeService({ usersRepo, emailService });

      const result = await service.signUp(signUpInput);

      expect(sendDuplicateRegistrationNotice).toHaveBeenCalledWith(
        'jane@acme.test',
      );
      expect(result.message).toContain('Check your email');
    });
  });

  describe('resendVerificationEmail', () => {
    it('regenerates the token and resends the set-password email for an unverified user', async () => {
      const user = {
        id: 'user-1',
        passwordHash: null,
      } as User;
      const update = jest.fn();
      const usersRepo = makeUsersRepo({
        findOne: jest.fn().mockResolvedValue(user),
        update,
      });
      const { emailService, sendSetPasswordEmail } = makeEmailService();
      const service = makeService({ usersRepo, emailService });

      const result = await service.resendVerificationEmail({
        email: 'jane@acme.test',
      });

      expect(update).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ emailVerificationToken: 'the-token' }),
      );
      expect(sendSetPasswordEmail).toHaveBeenCalledWith(
        'jane@acme.test',
        'the-token',
      );
      expect(result.message).toContain("we've sent a new link");
    });

    it('does nothing but returns the generic message for an unknown email', async () => {
      const usersRepo = makeUsersRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const { emailService, sendSetPasswordEmail } = makeEmailService();
      const service = makeService({ usersRepo, emailService });

      const result = await service.resendVerificationEmail({
        email: 'unknown@acme.test',
      });

      expect(sendSetPasswordEmail).not.toHaveBeenCalled();
      expect(result.message).toContain("we've sent a new link");
    });

    it('does nothing but returns the generic message for a user who already has a password', async () => {
      const user = {
        id: 'user-1',
        passwordHash: 'already-set',
      } as User;
      const usersRepo = makeUsersRepo({
        findOne: jest.fn().mockResolvedValue(user),
      });
      const { emailService, sendSetPasswordEmail } = makeEmailService();
      const service = makeService({ usersRepo, emailService });

      const result = await service.resendVerificationEmail({
        email: 'jane@acme.test',
      });

      expect(sendSetPasswordEmail).not.toHaveBeenCalled();
      expect(result.message).toContain("we've sent a new link");
    });
  });

  describe('setPassword', () => {
    it('hashes the password, marks the email verified, creates the pending organisation, issues a refresh token and logs the user in', async () => {
      const user = {
        id: 'user-1',
        emailVerificationToken: 'valid-token',
        emailVerificationExpiresAt: new Date(Date.now() + 60_000),
        pendingOrganisationName: 'Acme Inc',
        pendingOrganisationAddress: '1 Main St',
        pendingOrganisationWebsite: 'https://acme.test',
      } as User;
      const findOne = jest.fn().mockResolvedValue(user);
      const usersRepo = makeUsersRepo({ findOne });
      const { organisationsService, createForUser } =
        makeOrganisationsService();
      const { refreshTokenService, issue } = makeRefreshTokenService();
      const service = makeService({
        usersRepo,
        organisationsService,
        refreshTokenService,
      });
      const { response, cookie } = makeResponse();

      const result = await service.setPassword(
        { token: 'valid-token', password: 'correct-horse' },
        response,
      );

      expect(createForUser).toHaveBeenCalledWith(expect.anything(), 'user-1', {
        name: 'Acme Inc',
        address: '1 Main St',
        website: 'https://acme.test',
      });
      expect(issue).toHaveBeenCalledWith(expect.anything(), 'user-1');
      expect(cookie).toHaveBeenCalledWith(
        'access_token',
        'signed.jwt.token',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(cookie).toHaveBeenCalledWith(
        'refresh_token',
        'the-refresh-token',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(result.message).toContain('signed in');
    });

    it('rejects an unknown token', async () => {
      const findOne = jest.fn().mockResolvedValue(null);
      const service = makeService({ usersRepo: makeUsersRepo({ findOne }) });

      await expect(
        service.setPassword(
          { token: 'unknown-token', password: 'correct-horse' },
          makeResponse().response,
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('rejects an expired token', async () => {
      const user = {
        id: 'user-1',
        emailVerificationToken: 'expired-token',
        emailVerificationExpiresAt: new Date(Date.now() - 60_000),
      } as User;
      const findOne = jest.fn().mockResolvedValue(user);
      const service = makeService({ usersRepo: makeUsersRepo({ findOne }) });

      await expect(
        service.setPassword(
          { token: 'expired-token', password: 'correct-horse' },
          makeResponse().response,
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  describe('login', () => {
    it('verifies the password, issues a session, records an audit log entry and returns a success message', async () => {
      const user = {
        id: 'user-1',
        passwordHash: 'stored-hash',
      } as User;
      const findOne = jest.fn().mockResolvedValue(user);
      const verify = jest.fn().mockResolvedValue(true);
      const { refreshTokenService, issue } = makeRefreshTokenService();
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        usersRepo: makeUsersRepo({ findOne }),
        passwordService: makePasswordService({ verify }),
        refreshTokenService,
        auditLogService,
      });
      const { response, cookie } = makeResponse();

      const result = await service.login(
        { email: 'jane@acme.test', password: 'correct-horse' },
        response,
      );

      expect(verify).toHaveBeenCalledWith('stored-hash', 'correct-horse');
      expect(issue).toHaveBeenCalledWith(expect.anything(), 'user-1');
      expect(cookie).toHaveBeenCalledWith(
        'access_token',
        'signed.jwt.token',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(cookie).toHaveBeenCalledWith(
        'refresh_token',
        'the-refresh-token',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'login', actorUserId: 'user-1' }),
      );
      expect(result.message).toContain('Logged in');
    });

    it('upserts a device and returns a device token instead of cookies when deviceFingerprint is present', async () => {
      const user = {
        id: 'user-1',
        passwordHash: 'stored-hash',
      } as User;
      const findOne = jest.fn().mockResolvedValue(user);
      const verify = jest.fn().mockResolvedValue(true);
      const { deviceSessionService, upsertOnLogin } =
        makeDeviceSessionService();
      const service = makeService({
        usersRepo: makeUsersRepo({ findOne }),
        passwordService: makePasswordService({ verify }),
        membershipsRepo: makeMembershipsRepo({
          exists: jest.fn().mockResolvedValue(true),
          findOne: jest.fn().mockResolvedValue({ organisationId: 'org-1' }),
        }),
        deviceSessionService,
      });
      const { response, cookie } = makeResponse();

      const result = await service.login(
        {
          email: 'jane@acme.test',
          password: 'correct-horse',
          deviceFingerprint: 'fingerprint-1',
          platform: DevicePlatform.MACOS,
          hostname: 'janes-macbook',
        },
        response,
      );

      expect(upsertOnLogin).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: 'user-1',
          organisationId: 'org-1',
          deviceFingerprint: 'fingerprint-1',
          platform: DevicePlatform.MACOS,
          hostname: 'janes-macbook',
        }),
      );
      expect(cookie).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          deviceId: 'device-1',
          deviceToken: 'device-token',
        }),
      );
    });

    it('rejects a user with no active membership anywhere, without issuing a session', async () => {
      const user = {
        id: 'user-1',
        passwordHash: 'stored-hash',
      } as User;
      const findOne = jest.fn().mockResolvedValue(user);
      const verify = jest.fn().mockResolvedValue(true);
      const { refreshTokenService, issue } = makeRefreshTokenService();
      const service = makeService({
        usersRepo: makeUsersRepo({ findOne }),
        passwordService: makePasswordService({ verify }),
        membershipsRepo: makeMembershipsRepo({
          exists: jest.fn().mockResolvedValue(false),
        }),
        refreshTokenService,
      });
      const { response, cookie } = makeResponse();

      await expect(
        service.login(
          { email: 'deactivated@acme.test', password: 'correct-horse' },
          response,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(issue).not.toHaveBeenCalled();
      expect(cookie).not.toHaveBeenCalled();
    });

    it('rejects an unknown email with the generic invalid-login message', async () => {
      const findOne = jest.fn().mockResolvedValue(null);
      const verify = jest.fn().mockResolvedValue(false);
      const service = makeService({
        usersRepo: makeUsersRepo({ findOne }),
        passwordService: makePasswordService({ verify }),
      });

      await expect(
        service.login(
          { email: 'unknown@acme.test', password: 'whatever' },
          makeResponse().response,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(verify).toHaveBeenCalled();
    });

    it('rejects a wrong password with the generic invalid-login message and records the failure', async () => {
      const user = {
        id: 'user-1',
        passwordHash: 'stored-hash',
      } as User;
      const findOne = jest.fn().mockResolvedValue(user);
      const verify = jest.fn().mockResolvedValue(false);
      const { loginAttemptTracker, recordFailure } = makeLoginAttemptTracker();
      const service = makeService({
        usersRepo: makeUsersRepo({ findOne }),
        passwordService: makePasswordService({ verify }),
        loginAttemptTracker,
      });

      await expect(
        service.login(
          { email: 'jane@acme.test', password: 'wrong-password' },
          makeResponse().response,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(recordFailure).toHaveBeenCalledWith('jane@acme.test');
    });

    it('resets the failure count on a successful login', async () => {
      const user = {
        id: 'user-1',
        passwordHash: 'stored-hash',
      } as User;
      const findOne = jest.fn().mockResolvedValue(user);
      const verify = jest.fn().mockResolvedValue(true);
      const { loginAttemptTracker, reset } = makeLoginAttemptTracker();
      const service = makeService({
        usersRepo: makeUsersRepo({ findOne }),
        passwordService: makePasswordService({ verify }),
        loginAttemptTracker,
      });

      await service.login(
        { email: 'jane@acme.test', password: 'correct-horse' },
        makeResponse().response,
      );

      expect(reset).toHaveBeenCalledWith('jane@acme.test');
    });

    it('rejects with captchaRequired when a captcha is required but no token is provided', async () => {
      const { loginAttemptTracker } = makeLoginAttemptTracker();
      jest.spyOn(loginAttemptTracker, 'requiresCaptcha').mockReturnValue(true);
      const { captchaService, verify } = makeCaptchaService();
      const service = makeService({ loginAttemptTracker, captchaService });

      await expect(
        service.login(
          { email: 'jane@acme.test', password: 'whatever' },
          makeResponse().response,
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ captchaRequired: true }) as Record<
          string,
          unknown
        >,
      });
      expect(verify).toHaveBeenCalledWith(undefined);
    });

    it('rejects with captchaRequired when the provided captcha token is invalid', async () => {
      const { loginAttemptTracker } = makeLoginAttemptTracker();
      jest.spyOn(loginAttemptTracker, 'requiresCaptcha').mockReturnValue(true);
      const { captchaService } = makeCaptchaService();
      jest.spyOn(captchaService, 'verify').mockResolvedValue(false);
      const service = makeService({ loginAttemptTracker, captchaService });

      await expect(
        service.login(
          {
            email: 'jane@acme.test',
            password: 'whatever',
            captchaToken: 'bad-token',
          },
          makeResponse().response,
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ captchaRequired: true }) as Record<
          string,
          unknown
        >,
      });
    });

    it('logs the user in with a valid captcha token and the correct password', async () => {
      const user = {
        id: 'user-1',
        passwordHash: 'stored-hash',
      } as User;
      const findOne = jest.fn().mockResolvedValue(user);
      const verify = jest.fn().mockResolvedValue(true);
      const { loginAttemptTracker, reset } = makeLoginAttemptTracker();
      jest.spyOn(loginAttemptTracker, 'requiresCaptcha').mockReturnValue(true);
      const { captchaService, verify: verifyCaptcha } = makeCaptchaService();
      const service = makeService({
        usersRepo: makeUsersRepo({ findOne }),
        passwordService: makePasswordService({ verify }),
        loginAttemptTracker,
        captchaService,
      });

      const result = await service.login(
        {
          email: 'jane@acme.test',
          password: 'correct-horse',
          captchaToken: 'good-token',
        },
        makeResponse().response,
      );

      expect(verifyCaptcha).toHaveBeenCalledWith('good-token');
      expect(reset).toHaveBeenCalledWith('jane@acme.test');
      expect(result.message).toContain('Logged in');
    });

    it('rejects a user who never finished setting a password', async () => {
      const user = {
        id: 'user-1',
        passwordHash: null,
      } as User;
      const findOne = jest.fn().mockResolvedValue(user);
      const verify = jest.fn().mockResolvedValue(false);
      const service = makeService({
        usersRepo: makeUsersRepo({ findOne }),
        passwordService: makePasswordService({ verify }),
      });

      await expect(
        service.login(
          { email: 'jane@acme.test', password: 'whatever' },
          makeResponse().response,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    it('sets a reset token and emails a reset link for a user with a password', async () => {
      const user = { id: 'user-1', passwordHash: 'stored-hash' } as User;
      const update = jest.fn();
      const usersRepo = makeUsersRepo({
        findOne: jest.fn().mockResolvedValue(user),
        update,
      });
      const { emailService, sendPasswordResetEmail, sendSetPasswordEmail } =
        makeEmailService();
      const service = makeService({ usersRepo, emailService });

      const result = await service.forgotPassword({ email: 'jane@acme.test' });

      expect(update).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ passwordResetToken: 'the-token' }),
      );
      expect(sendPasswordResetEmail).toHaveBeenCalledWith(
        'jane@acme.test',
        'the-token',
      );
      expect(sendSetPasswordEmail).not.toHaveBeenCalled();
      expect(result.message).toContain('sent a password reset link');
    });

    it('resends the set-password email instead, for a user who never finished signup', async () => {
      const user = { id: 'user-1', passwordHash: null } as User;
      const update = jest.fn();
      const usersRepo = makeUsersRepo({
        findOne: jest.fn().mockResolvedValue(user),
        update,
      });
      const { emailService, sendPasswordResetEmail, sendSetPasswordEmail } =
        makeEmailService();
      const service = makeService({ usersRepo, emailService });

      await service.forgotPassword({ email: 'jane@acme.test' });

      expect(sendSetPasswordEmail).toHaveBeenCalledWith(
        'jane@acme.test',
        'the-token',
      );
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('does nothing but returns the same generic message for an unknown email', async () => {
      const usersRepo = makeUsersRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const { emailService, sendPasswordResetEmail, sendSetPasswordEmail } =
        makeEmailService();
      const service = makeService({ usersRepo, emailService });

      const result = await service.forgotPassword({
        email: 'unknown@acme.test',
      });

      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(sendSetPasswordEmail).not.toHaveBeenCalled();
      expect(result.message).toContain('sent a password reset link');
    });
  });

  describe('resetPassword', () => {
    it('hashes the new password, revokes existing sessions, records an audit log entry and logs the user in', async () => {
      const user = {
        id: 'user-1',
        passwordResetToken: 'valid-token',
        passwordResetExpiresAt: new Date(Date.now() + 60_000),
      } as User;
      const usersRepo = makeUsersRepo({
        findOne: jest.fn().mockResolvedValue(user),
      });
      const { refreshTokenService, issue, revokeAll } =
        makeRefreshTokenService();
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        usersRepo,
        refreshTokenService,
        auditLogService,
      });
      const { response, cookie } = makeResponse();

      const result = await service.resetPassword(
        { token: 'valid-token', password: 'correct-horse' },
        response,
      );

      expect(revokeAll).toHaveBeenCalledWith(expect.anything(), 'user-1');
      expect(issue).toHaveBeenCalledWith(expect.anything(), 'user-1');
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'password_reset',
          actorUserId: 'user-1',
        }),
      );
      expect(cookie).toHaveBeenCalledWith(
        'access_token',
        'signed.jwt.token',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(result.message).toContain('signed in');
    });

    it('rejects an unknown token', async () => {
      const usersRepo = makeUsersRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const service = makeService({ usersRepo });

      await expect(
        service.resetPassword(
          { token: 'unknown-token', password: 'correct-horse' },
          makeResponse().response,
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('rejects an expired token', async () => {
      const user = {
        id: 'user-1',
        passwordResetToken: 'expired-token',
        passwordResetExpiresAt: new Date(Date.now() - 60_000),
      } as User;
      const usersRepo = makeUsersRepo({
        findOne: jest.fn().mockResolvedValue(user),
      });
      const service = makeService({ usersRepo });

      await expect(
        service.resetPassword(
          { token: 'expired-token', password: 'correct-horse' },
          makeResponse().response,
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  describe('refresh', () => {
    it('rotates the presented refresh token and issues a new session', async () => {
      const { refreshTokenService, rotate } = makeRefreshTokenService();
      const service = makeService({ refreshTokenService });
      const { response, cookie } = makeResponse();
      const request = makeRequest('refresh_token=old-refresh-token');

      const result = await service.refresh(request, response);

      expect(rotate).toHaveBeenCalledWith(
        expect.anything(),
        'old-refresh-token',
      );
      expect(cookie).toHaveBeenCalledWith(
        'access_token',
        'signed.jwt.token',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(cookie).toHaveBeenCalledWith(
        'refresh_token',
        'rotated-refresh-token',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(result.message).toContain('refreshed');
    });

    it('rejects when no refresh-token cookie is present', async () => {
      const service = makeService();
      const request = makeRequest(undefined);

      await expect(
        service.refresh(request, makeResponse().response),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('revokes the refresh token and clears both session cookies', async () => {
      const { refreshTokenService, revokeByValue } = makeRefreshTokenService();
      const service = makeService({ refreshTokenService });
      const { response, clearCookie } = makeResponse();
      const request = makeRequest('refresh_token=some-refresh-token');

      const result = await service.logout(request, response);

      expect(revokeByValue).toHaveBeenCalledWith(
        expect.anything(),
        'some-refresh-token',
      );
      expect(clearCookie).toHaveBeenCalledWith(
        'access_token',
        expect.objectContaining({ path: '/' }),
      );
      expect(clearCookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.objectContaining({ path: '/' }),
      );
      expect(result.message).toContain('Logged out');
    });

    it('still clears cookies when there is no refresh-token cookie to revoke', async () => {
      const { refreshTokenService, revokeByValue } = makeRefreshTokenService();
      const service = makeService({ refreshTokenService });
      const { response, clearCookie } = makeResponse();
      const request = makeRequest(undefined);

      await service.logout(request, response);

      expect(revokeByValue).not.toHaveBeenCalled();
      expect(clearCookie).toHaveBeenCalledWith(
        'access_token',
        expect.objectContaining({ path: '/' }),
      );
    });
  });

  describe('getProfile', () => {
    it("returns the user's profile fields", async () => {
      const usersRepo = makeUsersRepo({
        findOneOrFail: jest.fn().mockResolvedValue({
          email: 'jane@acme.test',
          name: 'Jane Doe',
          firstName: 'Jane',
          lastName: 'Doe',
          avatarUrl: null,
        }),
      });
      const service = makeService({ usersRepo });

      await expect(service.getProfile('user-1')).resolves.toEqual({
        email: 'jane@acme.test',
        name: 'Jane Doe',
        firstName: 'Jane',
        lastName: 'Doe',
        avatarUrl: null,
      });
    });
  });

  describe('updateProfile', () => {
    it('updates the provided name fields, keeps the rest, and returns the refreshed profile', async () => {
      const update = jest.fn().mockResolvedValue(undefined);
      const findOneOrFail = jest
        .fn()
        .mockResolvedValueOnce({
          email: 'jane@acme.test',
          name: 'Jane Doe',
          firstName: 'Jane',
          lastName: 'Doe',
          avatarUrl: null,
        })
        .mockResolvedValueOnce({
          email: 'jane@acme.test',
          name: 'Jane Smith',
          firstName: 'Jane',
          lastName: 'Smith',
          avatarUrl: null,
        });
      const usersRepo = makeUsersRepo({ update, findOneOrFail });
      const service = makeService({ usersRepo });

      const profile = await service.updateProfile('user-1', {
        lastName: 'Smith',
      });

      expect(update).toHaveBeenCalledWith('user-1', {
        firstName: 'Jane',
        lastName: 'Smith',
        name: 'Jane Smith',
      });
      expect(profile).toEqual({
        email: 'jane@acme.test',
        name: 'Jane Smith',
        firstName: 'Jane',
        lastName: 'Smith',
        avatarUrl: null,
      });
    });

    it('clears the avatar when avatarUrl is an empty string', async () => {
      const update = jest.fn().mockResolvedValue(undefined);
      const findOneOrFail = jest.fn().mockResolvedValue({
        email: 'jane@acme.test',
        name: 'Jane Doe',
        firstName: 'Jane',
        lastName: 'Doe',
        avatarUrl: 'data:image/png;base64,abc',
      });
      const usersRepo = makeUsersRepo({ update, findOneOrFail });
      const service = makeService({ usersRepo });

      await service.updateProfile('user-1', { avatarUrl: '' });

      expect(update).toHaveBeenCalledWith('user-1', {
        firstName: 'Jane',
        lastName: 'Doe',
        name: 'Jane Doe',
        avatarUrl: null,
      });
    });

    it('stores a new avatar data URI as-is', async () => {
      const update = jest.fn().mockResolvedValue(undefined);
      const findOneOrFail = jest.fn().mockResolvedValue({
        email: 'jane@acme.test',
        name: 'Jane Doe',
        firstName: 'Jane',
        lastName: 'Doe',
        avatarUrl: null,
      });
      const usersRepo = makeUsersRepo({ update, findOneOrFail });
      const service = makeService({ usersRepo });

      await service.updateProfile('user-1', {
        avatarUrl: 'data:image/png;base64,xyz',
      });

      expect(update).toHaveBeenCalledWith('user-1', {
        firstName: 'Jane',
        lastName: 'Doe',
        name: 'Jane Doe',
        avatarUrl: 'data:image/png;base64,xyz',
      });
    });
  });
});
