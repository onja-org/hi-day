import {
  ForbiddenException,
  NotFoundException,
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
import { TimeEntriesService } from '../../../time-entries/services/time-entries.service';
import { AccessTokenService } from '../access-token.service';
import { AuthService } from '../auth.service';
import { CaptchaService } from '../captcha.service';
import { LoginAttemptTracker } from '../login-attempt-tracker.service';
import { PasswordService } from '../password.service';
import { RefreshTokenService } from '../refresh-token.service';
import { TokenService } from '../token.service';
import { TwoFactorService } from '../two-factor.service';

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
    const update = jest.fn().mockResolvedValue({ affected: 1 });
    const manager = { update } as unknown as EntityManager;
    const transaction = jest.fn(
      (fn: (manager: EntityManager) => Promise<unknown>) => fn(manager),
    );
    return {
      dataSource: { transaction, manager } as unknown,
      manager,
      transaction,
      update,
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
      ...overrides,
    };
  }

  function makeAccessTokenService() {
    const sign = jest.fn().mockResolvedValue('signed.jwt.token');
    const verify = jest.fn().mockResolvedValue(null);
    const endAllSessions = jest.fn().mockResolvedValue(undefined);
    return {
      accessTokenService: {
        sign,
        verify,
        endAllSessions,
      } as unknown as AccessTokenService,
      sign,
      verify,
      endAllSessions,
    };
  }

  function makeRefreshTokenService() {
    const issue = jest.fn().mockResolvedValue('the-refresh-token');
    const rotate = jest.fn().mockResolvedValue({
      outcome: 'rotated',
      userId: 'user-1',
      token: 'rotated-refresh-token',
    });
    const revokeAll = jest.fn().mockResolvedValue(undefined);
    const revokeByValue = jest.fn().mockResolvedValue('user-1');
    const findLiveOwner = jest.fn().mockResolvedValue('user-1');
    return {
      refreshTokenService: {
        issue,
        rotate,
        revokeAll,
        revokeByValue,
        findLiveOwner,
      } as unknown as RefreshTokenService,
      issue,
      rotate,
      revokeAll,
      revokeByValue,
      findLiveOwner,
    };
  }

  function makeTwoFactorService(overrides: Partial<TwoFactorService> = {}) {
    const isEnabled = jest.fn(
      (user: Pick<User, 'twoFactorEnabledAt'>) =>
        user.twoFactorEnabledAt != null,
    );
    const startChallenge = jest.fn().mockResolvedValue('the-challenge');
    const findChallengeOwner = jest.fn().mockResolvedValue(null);
    const endChallenge = jest.fn().mockResolvedValue(undefined);
    const checkCode = jest.fn().mockResolvedValue({ ok: false });
    const isTrustedBrowser = jest.fn().mockResolvedValue(false);
    const trustBrowser = jest.fn().mockResolvedValue('the-trust-token');
    const forgetTrustedBrowsers = jest.fn().mockResolvedValue(undefined);
    const twoFactorService = {
      isEnabled,
      startChallenge,
      findChallengeOwner,
      endChallenge,
      checkCode,
      isTrustedBrowser,
      trustBrowser,
      forgetTrustedBrowsers,
      ...overrides,
    } as unknown as TwoFactorService;
    return {
      twoFactorService,
      isEnabled,
      startChallenge,
      findChallengeOwner,
      endChallenge,
      checkCode,
      isTrustedBrowser,
      trustBrowser,
      forgetTrustedBrowsers,
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
    const allowOneMoreAttempt = jest.fn();
    return {
      loginAttemptTracker: {
        requiresCaptcha,
        recordFailure,
        reset,
        allowOneMoreAttempt,
      } as unknown as LoginAttemptTracker,
      requiresCaptcha,
      recordFailure,
      reset,
      allowOneMoreAttempt,
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
    const revokeAllForUser = jest.fn().mockResolvedValue([]);
    return {
      deviceSessionService: {
        upsertOnLogin,
        revokeAllForUser,
      } as unknown as DeviceSessionService,
      upsertOnLogin,
      revokeAllForUser,
    };
  }

  function makeTimeEntriesService() {
    const stopAll = jest.fn().mockResolvedValue(undefined);
    return {
      timeEntriesService: { stopAll } as unknown as TimeEntriesService,
      stopAll,
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
      accessTokenService?: AccessTokenService;
      refreshTokenService?: RefreshTokenService;
      emailService?: EmailService;
      organisationsService?: OrganisationsService;
      auditLogService?: AuditLogService;
      loginAttemptTracker?: LoginAttemptTracker;
      captchaService?: CaptchaService;
      deviceSessionService?: DeviceSessionService;
      timeEntriesService?: TimeEntriesService;
      twoFactorService?: TwoFactorService;
    } = {},
  ) {
    return new AuthService(
      overrides.usersRepo ?? makeUsersRepo(),
      overrides.membershipsRepo ?? makeMembershipsRepo(),
      (overrides.dataSource ?? makeDataSource().dataSource) as never,
      overrides.configService ?? makeConfigService(),
      (overrides.passwordService ?? makePasswordService()) as PasswordService,
      overrides.tokenService ?? makeTokenService(),
      overrides.accessTokenService ??
        makeAccessTokenService().accessTokenService,
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
      overrides.timeEntriesService ??
        makeTimeEntriesService().timeEntriesService,
      overrides.twoFactorService ?? makeTwoFactorService().twoFactorService,
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
        'Acme Inc',
      );
      expect(result.message).toContain('Check your email');
    });

    it('sends a duplicate-registration notice without creating a second user', async () => {
      const save = jest.fn();
      const usersRepo = makeUsersRepo({
        findOne: jest.fn().mockResolvedValue({
          id: 'existing-user',
          pendingOrganisationName: 'Acme Inc',
        }),
        save,
      });
      const { emailService, sendDuplicateRegistrationNotice } =
        makeEmailService();
      const service = makeService({ usersRepo, emailService });

      await service.signUp(signUpInput);

      expect(save).not.toHaveBeenCalled();
      expect(sendDuplicateRegistrationNotice).toHaveBeenCalledWith(
        'jane@acme.test',
        'Acme Inc',
      );
    });

    it('treats a unique-constraint violation on save as a duplicate registration', async () => {
      const uniqueViolation = Object.assign(
        new QueryFailedError('insert', [], new Error('duplicate key')),
        { driverError: { code: '23505' } },
      );
      const usersRepo = makeUsersRepo({
        findOne: jest.fn().mockResolvedValue(null),
        findOneOrFail: jest.fn().mockResolvedValue({
          id: 'existing-user',
          pendingOrganisationName: 'Acme Inc',
        }),
        save: jest.fn().mockRejectedValue(uniqueViolation),
      });
      const { emailService, sendDuplicateRegistrationNotice } =
        makeEmailService();
      const service = makeService({ usersRepo, emailService });

      const result = await service.signUp(signUpInput);

      expect(sendDuplicateRegistrationNotice).toHaveBeenCalledWith(
        'jane@acme.test',
        'Acme Inc',
      );
      expect(result.message).toContain('Check your email');
    });
  });

  describe('resendVerificationEmail', () => {
    it('regenerates the token and resends the set-password email for an unverified user', async () => {
      const user = {
        id: 'user-1',
        passwordHash: null,
        pendingOrganisationName: 'Acme Inc',
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
        'Acme Inc',
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
        timezone: undefined,
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

    /**
     * Everything that asks when a day begins reads the Organisation's
     * zone. Defaulting it to UTC had every organisation outside it cutting
     * days at the wrong hour — in Madagascar, at three in the morning —
     * until an admin noticed a setting nobody had chosen.
     */
    it('founds the organisation in the zone the browser reported', async () => {
      const user = {
        id: 'user-1',
        emailVerificationToken: 'valid-token',
        emailVerificationExpiresAt: new Date(Date.now() + 60_000),
        pendingOrganisationName: 'Acme Inc',
        pendingOrganisationAddress: null,
        pendingOrganisationWebsite: null,
      } as User;
      const usersRepo = makeUsersRepo({
        findOne: jest.fn().mockResolvedValue(user),
      });
      const { organisationsService, createForUser } =
        makeOrganisationsService();
      const { dataSource, update } = makeDataSource();
      const service = makeService({
        usersRepo,
        organisationsService,
        dataSource,
      });

      await service.setPassword(
        {
          token: 'valid-token',
          password: 'correct-horse',
          timezone: 'Indian/Antananarivo',
        },
        makeResponse().response,
      );

      expect(createForUser).toHaveBeenCalledWith(
        expect.anything(),
        'user-1',
        expect.objectContaining({ timezone: 'Indian/Antananarivo' }),
      );
      // The same report is this person's own zone too.
      expect(update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ id: 'user-1' }),
        expect.objectContaining({ timezone: 'Indian/Antananarivo' }),
      );
    });

    /**
     * A double-click sends two requests that both find the user by the
     * token before either one clears it. Only the request that actually
     * clears the token may found the organisation; the other must stop.
     */
    it('founds no second organisation when the token was already used by a concurrent request', async () => {
      const user = {
        id: 'user-1',
        emailVerificationToken: 'valid-token',
        emailVerificationExpiresAt: new Date(Date.now() + 60_000),
        pendingOrganisationName: 'Acme Inc',
        pendingOrganisationAddress: null,
        pendingOrganisationWebsite: null,
      } as User;
      const usersRepo = makeUsersRepo({
        findOne: jest.fn().mockResolvedValue(user),
      });
      const { organisationsService, createForUser } =
        makeOrganisationsService();
      const { refreshTokenService, issue } = makeRefreshTokenService();
      const { dataSource, update } = makeDataSource();
      update.mockResolvedValue({ affected: 0 });
      const service = makeService({
        usersRepo,
        organisationsService,
        refreshTokenService,
        dataSource,
      });
      const { response, cookie } = makeResponse();

      await expect(
        service.setPassword(
          { token: 'valid-token', password: 'correct-horse' },
          response,
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      // The update is conditional on the token still being there.
      expect(update).toHaveBeenCalledWith(
        expect.anything(),
        { id: 'user-1', emailVerificationToken: 'valid-token' },
        expect.anything(),
      );
      expect(createForUser).not.toHaveBeenCalled();
      expect(issue).not.toHaveBeenCalled();
      expect(cookie).not.toHaveBeenCalled();
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
        makeRequest(),
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
          find: jest.fn().mockResolvedValue([{ organisationId: 'org-1' }]),
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
        makeRequest(),
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

    it('refuses a desktop password login for someone in more than one organisation, rather than guessing which', async () => {
      const user = {
        id: 'user-1',
        passwordHash: 'stored-hash',
      } as User;
      const { deviceSessionService, upsertOnLogin } =
        makeDeviceSessionService();
      const service = makeService({
        usersRepo: makeUsersRepo({
          findOne: jest.fn().mockResolvedValue(user),
        }),
        passwordService: makePasswordService({
          verify: jest.fn().mockResolvedValue(true),
        }),
        membershipsRepo: makeMembershipsRepo({
          exists: jest.fn().mockResolvedValue(true),
          find: jest
            .fn()
            .mockResolvedValue([
              { organisationId: 'org-a' },
              { organisationId: 'org-b' },
            ]),
        }),
        deviceSessionService,
      });
      const { response } = makeResponse();

      await expect(
        service.login(
          {
            email: 'jane@acme.test',
            password: 'correct-horse',
            deviceFingerprint: 'fingerprint-1',
            platform: DevicePlatform.MACOS,
          },
          response,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(upsertOnLogin).not.toHaveBeenCalled();
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
          makeRequest(),
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
          makeRequest(),
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
          makeRequest(),
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
        makeRequest(),
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
          makeRequest(),
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
          makeRequest(),
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
        makeRequest(),
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
          makeRequest(),
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
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ organisation: { name: 'Acme Inc' } }),
      });
      const { emailService, sendPasswordResetEmail, sendSetPasswordEmail } =
        makeEmailService();
      const service = makeService({ usersRepo, membershipsRepo, emailService });

      const result = await service.forgotPassword({ email: 'jane@acme.test' });

      expect(update).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ passwordResetToken: 'the-token' }),
      );
      expect(sendPasswordResetEmail).toHaveBeenCalledWith(
        'jane@acme.test',
        'the-token',
        'Acme Inc',
      );
      expect(sendSetPasswordEmail).not.toHaveBeenCalled();
      expect(result.message).toContain('sent a password reset link');
    });

    it('resends the set-password email instead, for a user who never finished signup', async () => {
      const user = {
        id: 'user-1',
        passwordHash: null,
        pendingOrganisationName: 'Acme Inc',
      } as User;
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
        'Acme Inc',
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
      const { accessTokenService, endAllSessions } = makeAccessTokenService();
      const { auditLogService, record } = makeAuditLogService();
      const { deviceSessionService, revokeAllForUser } =
        makeDeviceSessionService();
      const service = makeService({
        usersRepo,
        refreshTokenService,
        accessTokenService,
        auditLogService,
        deviceSessionService,
      });
      const { response, cookie } = makeResponse();

      const result = await service.resetPassword(
        { token: 'valid-token', password: 'correct-horse' },
        response,
      );

      expect(revokeAll).toHaveBeenCalledWith(expect.anything(), 'user-1');
      expect(endAllSessions).toHaveBeenCalledWith(expect.anything(), 'user-1');
      expect(revokeAllForUser).toHaveBeenCalledWith('user-1');
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

    it('rotates no sessions when the token was already used by a concurrent request', async () => {
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
      const { dataSource, update } = makeDataSource();
      update.mockResolvedValue({ affected: 0 });
      const service = makeService({
        usersRepo,
        refreshTokenService,
        auditLogService,
        dataSource,
      });
      const { response, cookie } = makeResponse();

      await expect(
        service.resetPassword(
          { token: 'valid-token', password: 'correct-horse' },
          response,
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      expect(update).toHaveBeenCalledWith(
        expect.anything(),
        { id: 'user-1', passwordResetToken: 'valid-token' },
        expect.anything(),
      );
      expect(revokeAll).not.toHaveBeenCalled();
      expect(issue).not.toHaveBeenCalled();
      expect(record).not.toHaveBeenCalled();
      expect(cookie).not.toHaveBeenCalled();
    });

    it('signs the new access token only after the session version is bumped and committed, so this browser stays signed in', async () => {
      const user = {
        id: 'user-1',
        passwordResetToken: 'valid-token',
        passwordResetExpiresAt: new Date(Date.now() + 60_000),
      } as User;
      const usersRepo = makeUsersRepo({
        findOne: jest.fn().mockResolvedValue(user),
      });
      const { accessTokenService, endAllSessions, sign } =
        makeAccessTokenService();
      const service = makeService({ usersRepo, accessTokenService });

      await service.resetPassword(
        { token: 'valid-token', password: 'correct-horse' },
        makeResponse().response,
      );

      expect(endAllSessions.mock.invocationCallOrder[0]).toBeLessThan(
        sign.mock.invocationCallOrder[0],
      );
      expect(sign).toHaveBeenCalledWith('user-1');
    });

    it('stops whatever is running in each organisation a revoked device session belonged to', async () => {
      const user = {
        id: 'user-1',
        passwordResetToken: 'valid-token',
        passwordResetExpiresAt: new Date(Date.now() + 60_000),
      } as User;
      const usersRepo = makeUsersRepo({
        findOne: jest.fn().mockResolvedValue(user),
      });
      const { deviceSessionService, revokeAllForUser } =
        makeDeviceSessionService();
      revokeAllForUser.mockResolvedValue(['org-1', 'org-2']);
      const { timeEntriesService, stopAll } = makeTimeEntriesService();
      const service = makeService({
        usersRepo,
        deviceSessionService,
        timeEntriesService,
      });

      await service.resetPassword(
        { token: 'valid-token', password: 'correct-horse' },
        makeResponse().response,
      );

      expect(stopAll).toHaveBeenCalledWith('org-1', 'user-1');
      expect(stopAll).toHaveBeenCalledWith('org-2', 'user-1');
    });

    it('does not fail when a revoked device has no running timer to stop', async () => {
      const user = {
        id: 'user-1',
        passwordResetToken: 'valid-token',
        passwordResetExpiresAt: new Date(Date.now() + 60_000),
      } as User;
      const usersRepo = makeUsersRepo({
        findOne: jest.fn().mockResolvedValue(user),
      });
      const { deviceSessionService, revokeAllForUser } =
        makeDeviceSessionService();
      revokeAllForUser.mockResolvedValue(['org-1']);
      const { timeEntriesService, stopAll } = makeTimeEntriesService();
      stopAll.mockRejectedValue(new NotFoundException('No timer is running.'));
      const service = makeService({
        usersRepo,
        deviceSessionService,
        timeEntriesService,
      });

      await expect(
        service.resetPassword(
          { token: 'valid-token', password: 'correct-horse' },
          makeResponse().response,
        ),
      ).resolves.toEqual(
        expect.objectContaining({
          message: expect.stringContaining('signed in') as string,
        }),
      );
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

    it('clears the session cookies when the presented token cannot be rotated', async () => {
      const { refreshTokenService, rotate } = makeRefreshTokenService();
      rotate.mockRejectedValue(new UnauthorizedException('nope'));
      const service = makeService({ refreshTokenService });
      const { response, clearCookie } = makeResponse();
      const request = makeRequest('refresh_token=spent-refresh-token');

      await expect(service.refresh(request, response)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(clearCookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.objectContaining({ path: '/' }),
      );
      expect(clearCookie).toHaveBeenCalledWith(
        'access_token',
        expect.objectContaining({ path: '/' }),
      );
    });

    it('ends every web session, in a transaction of its own, when a stolen refresh token is replayed', async () => {
      const { refreshTokenService, rotate, revokeAll } =
        makeRefreshTokenService();
      rotate.mockResolvedValue({ outcome: 'reuse_detected', userId: 'user-1' });
      const { accessTokenService, endAllSessions, sign } =
        makeAccessTokenService();
      const { dataSource, transaction } = makeDataSource();
      const { deviceSessionService, revokeAllForUser } =
        makeDeviceSessionService();
      const service = makeService({
        refreshTokenService,
        accessTokenService,
        dataSource,
        deviceSessionService,
      });
      const { response, clearCookie, cookie } = makeResponse();
      const request = makeRequest('refresh_token=stolen-refresh-token');

      await expect(service.refresh(request, response)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      // One transaction for the lookup, a separate one for the revocation,
      // so the error can't roll the revocation back.
      expect(transaction).toHaveBeenCalledTimes(2);
      expect(revokeAll).toHaveBeenCalledWith(expect.anything(), 'user-1');
      expect(endAllSessions).toHaveBeenCalledWith(expect.anything(), 'user-1');
      expect(rotate.mock.invocationCallOrder[0]).toBeLessThan(
        revokeAll.mock.invocationCallOrder[0],
      );
      // Paired desktop apps aren't touched: a stolen browser cookie says
      // nothing about them.
      expect(revokeAllForUser).not.toHaveBeenCalled();
      expect(sign).not.toHaveBeenCalled();
      expect(cookie).not.toHaveBeenCalled();
      expect(clearCookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.objectContaining({ path: '/' }),
      );
    });

    it('renews only the access cookie when a concurrent refresh already rotated the token', async () => {
      const { refreshTokenService, rotate, revokeAll } =
        makeRefreshTokenService();
      rotate.mockResolvedValue({ outcome: 'raced', userId: 'user-1' });
      const service = makeService({ refreshTokenService });
      const { response, cookie, clearCookie } = makeResponse();
      const request = makeRequest('refresh_token=raced-refresh-token');

      const result = await service.refresh(request, response);

      expect(cookie).toHaveBeenCalledWith(
        'access_token',
        'signed.jwt.token',
        expect.objectContaining({ httpOnly: true }),
      );
      // The winning request's response sets the refresh cookie; a second
      // one here could land after it and leave the browser a dead token.
      expect(cookie).not.toHaveBeenCalledWith(
        'refresh_token',
        expect.anything(),
        expect.anything(),
      );
      expect(clearCookie).not.toHaveBeenCalled();
      expect(revokeAll).not.toHaveBeenCalled();
      expect(result.message).toContain('refreshed');
    });

    it('clears the session cookies when there is no refresh-token cookie', async () => {
      const service = makeService();
      const { response, clearCookie } = makeResponse();

      await expect(
        service.refresh(makeRequest(undefined), response),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(clearCookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.objectContaining({ path: '/' }),
      );
    });

    it('leaves the session cookies alone when the refresh succeeds', async () => {
      const { refreshTokenService } = makeRefreshTokenService();
      const service = makeService({ refreshTokenService });
      const { response, clearCookie } = makeResponse();

      await service.refresh(makeRequest('refresh_token=good'), response);

      expect(clearCookie).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('revokes the refresh token and clears both session cookies, without touching paired devices', async () => {
      const { refreshTokenService, revokeByValue } = makeRefreshTokenService();
      const { deviceSessionService, revokeAllForUser } =
        makeDeviceSessionService();
      const service = makeService({
        refreshTokenService,
        deviceSessionService,
      });
      const { response, clearCookie } = makeResponse();
      const request = makeRequest('refresh_token=some-refresh-token');

      const result = await service.logout(request, response);

      expect(revokeByValue).toHaveBeenCalledWith(
        expect.anything(),
        'some-refresh-token',
      );
      expect(revokeAllForUser).not.toHaveBeenCalled();
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
      const { deviceSessionService, revokeAllForUser } =
        makeDeviceSessionService();
      const service = makeService({
        refreshTokenService,
        deviceSessionService,
      });
      const { response, clearCookie } = makeResponse();
      const request = makeRequest(undefined);

      await service.logout(request, response);

      expect(revokeByValue).not.toHaveBeenCalled();
      expect(revokeAllForUser).not.toHaveBeenCalled();
      expect(clearCookie).toHaveBeenCalledWith(
        'access_token',
        expect.objectContaining({ path: '/' }),
      );
    });
  });

  describe('logoutEverywhere', () => {
    it('revokes every refresh token and access token the user has, signs out every device, and clears both session cookies', async () => {
      const { refreshTokenService, findLiveOwner, revokeAll } =
        makeRefreshTokenService();
      const { accessTokenService, endAllSessions } = makeAccessTokenService();
      const { deviceSessionService, revokeAllForUser } =
        makeDeviceSessionService();
      const service = makeService({
        refreshTokenService,
        accessTokenService,
        deviceSessionService,
      });
      const { response, clearCookie } = makeResponse();
      const request = makeRequest('refresh_token=some-refresh-token');

      const result = await service.logoutEverywhere(request, response);

      expect(findLiveOwner).toHaveBeenCalledWith(
        expect.anything(),
        'some-refresh-token',
      );
      expect(revokeAll).toHaveBeenCalledWith(expect.anything(), 'user-1');
      expect(endAllSessions).toHaveBeenCalledWith(expect.anything(), 'user-1');
      expect(revokeAllForUser).toHaveBeenCalledWith('user-1');
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

    it('falls back to a still-valid access token when there is no usable refresh token', async () => {
      const { refreshTokenService, revokeAll } = makeRefreshTokenService();
      const { accessTokenService, verify, endAllSessions } =
        makeAccessTokenService();
      verify.mockResolvedValue('user-1');
      const service = makeService({ refreshTokenService, accessTokenService });
      const request = makeRequest('access_token=valid.jwt.token');

      await service.logoutEverywhere(request, makeResponse().response);

      expect(verify).toHaveBeenCalledWith('valid.jwt.token');
      expect(revokeAll).toHaveBeenCalledWith(expect.anything(), 'user-1');
      expect(endAllSessions).toHaveBeenCalledWith(expect.anything(), 'user-1');
    });

    it('does nothing to the account when the cookies are already revoked or expired', async () => {
      const { refreshTokenService, findLiveOwner, revokeAll } =
        makeRefreshTokenService();
      findLiveOwner.mockResolvedValue(null);
      const { accessTokenService, endAllSessions } = makeAccessTokenService();
      const { deviceSessionService, revokeAllForUser } =
        makeDeviceSessionService();
      const service = makeService({
        refreshTokenService,
        accessTokenService,
        deviceSessionService,
      });
      const { response, clearCookie } = makeResponse();
      const request = makeRequest(
        'refresh_token=old-rotated-token; access_token=revoked.jwt.token',
      );

      await service.logoutEverywhere(request, response);

      expect(revokeAll).not.toHaveBeenCalled();
      expect(endAllSessions).not.toHaveBeenCalled();
      expect(revokeAllForUser).not.toHaveBeenCalled();
      expect(clearCookie).toHaveBeenCalledWith(
        'access_token',
        expect.objectContaining({ path: '/' }),
      );
    });

    it("stops whatever is running in each revoked device's organisation", async () => {
      const { refreshTokenService } = makeRefreshTokenService();
      const { deviceSessionService, revokeAllForUser } =
        makeDeviceSessionService();
      revokeAllForUser.mockResolvedValue(['org-1', 'org-2']);
      const { timeEntriesService, stopAll } = makeTimeEntriesService();
      const service = makeService({
        refreshTokenService,
        deviceSessionService,
        timeEntriesService,
      });
      const request = makeRequest('refresh_token=some-refresh-token');

      await service.logoutEverywhere(request, makeResponse().response);

      expect(stopAll).toHaveBeenCalledWith('org-1', 'user-1');
      expect(stopAll).toHaveBeenCalledWith('org-2', 'user-1');
    });

    it('does not fail when a revoked device has no running timer to stop', async () => {
      const { refreshTokenService } = makeRefreshTokenService();
      const { deviceSessionService, revokeAllForUser } =
        makeDeviceSessionService();
      revokeAllForUser.mockResolvedValue(['org-1']);
      const { timeEntriesService, stopAll } = makeTimeEntriesService();
      stopAll.mockRejectedValue(new NotFoundException('No timer is running.'));
      const service = makeService({
        refreshTokenService,
        deviceSessionService,
        timeEntriesService,
      });
      const request = makeRequest('refresh_token=some-refresh-token');

      await expect(
        service.logoutEverywhere(request, makeResponse().response),
      ).resolves.toEqual(
        expect.objectContaining({
          message: expect.stringContaining('Logged out') as string,
        }),
      );
    });

    it('still clears cookies when there are no session cookies at all', async () => {
      const { refreshTokenService, findLiveOwner, revokeAll } =
        makeRefreshTokenService();
      const { deviceSessionService, revokeAllForUser } =
        makeDeviceSessionService();
      const service = makeService({
        refreshTokenService,
        deviceSessionService,
      });
      const { response, clearCookie } = makeResponse();
      const request = makeRequest(undefined);

      await service.logoutEverywhere(request, response);

      expect(findLiveOwner).not.toHaveBeenCalled();
      expect(revokeAll).not.toHaveBeenCalled();
      expect(revokeAllForUser).not.toHaveBeenCalled();
      expect(clearCookie).toHaveBeenCalledWith(
        'access_token',
        expect.objectContaining({ path: '/' }),
      );
    });
  });

  describe('getProfile', () => {
    it("returns the user's id and profile fields", async () => {
      const usersRepo = makeUsersRepo({
        findOneOrFail: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'jane@acme.test',
          name: 'Jane Doe',
          firstName: 'Jane',
          lastName: 'Doe',
          avatarUrl: null,
        }),
      });
      const service = makeService({ usersRepo });

      await expect(service.getProfile('user-1')).resolves.toEqual({
        id: 'user-1',
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

  describe('two-step login', () => {
    const twoFactorUser = {
      id: 'user-1',
      email: 'jane@acme.test',
      passwordHash: 'stored-hash',
      twoFactorEnabledAt: new Date('2026-01-01'),
    } as User;

    it('asks for a code instead of signing in when the password is right', async () => {
      const { refreshTokenService, issue } = makeRefreshTokenService();
      const { twoFactorService, startChallenge } = makeTwoFactorService();
      const { loginAttemptTracker, reset } = makeLoginAttemptTracker();
      const service = makeService({
        usersRepo: makeUsersRepo({
          findOne: jest.fn().mockResolvedValue(twoFactorUser),
        }),
        passwordService: makePasswordService({
          verify: jest.fn().mockResolvedValue(true),
        }),
        refreshTokenService,
        twoFactorService,
        loginAttemptTracker,
      });
      const { response, cookie } = makeResponse();

      const result = await service.login(
        { email: 'jane@acme.test', password: 'correct-horse' },
        makeRequest(),
        response,
      );

      expect(result.twoFactorRequired).toBe(true);
      expect(startChallenge).toHaveBeenCalledWith('user-1');
      expect(cookie).toHaveBeenCalledWith(
        'two_factor_challenge',
        'the-challenge',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(cookie).not.toHaveBeenCalledWith(
        'access_token',
        expect.anything(),
        expect.anything(),
      );
      expect(issue).not.toHaveBeenCalled();
      // Wrong attempts keep counting until a code is right.
      expect(reset).not.toHaveBeenCalled();
    });

    it('gives the code step one try after a solved captcha and a right password', async () => {
      const {
        loginAttemptTracker,
        requiresCaptcha,
        reset,
        allowOneMoreAttempt,
      } = makeLoginAttemptTracker();
      requiresCaptcha.mockReturnValue(true);
      const service = makeService({
        usersRepo: makeUsersRepo({
          findOne: jest.fn().mockResolvedValue(twoFactorUser),
        }),
        passwordService: makePasswordService({
          verify: jest.fn().mockResolvedValue(true),
        }),
        loginAttemptTracker,
      });

      const result = await service.login(
        {
          email: 'jane@acme.test',
          password: 'correct-horse',
          captchaToken: 'solved',
        },
        makeRequest(),
        makeResponse().response,
      );

      expect(result.twoFactorRequired).toBe(true);
      expect(allowOneMoreAttempt).toHaveBeenCalledWith('jane@acme.test');
      expect(reset).not.toHaveBeenCalled();
    });

    it("refuses the desktop app's old password form, which has no code step", async () => {
      const { deviceSessionService, upsertOnLogin } =
        makeDeviceSessionService();
      const service = makeService({
        usersRepo: makeUsersRepo({
          findOne: jest.fn().mockResolvedValue(twoFactorUser),
        }),
        passwordService: makePasswordService({
          verify: jest.fn().mockResolvedValue(true),
        }),
        deviceSessionService,
      });

      await expect(
        service.login(
          {
            email: 'jane@acme.test',
            password: 'correct-horse',
            deviceFingerprint: 'fp',
            platform: DevicePlatform.MACOS,
          },
          makeRequest(),
          makeResponse().response,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(upsertOnLogin).not.toHaveBeenCalled();
    });

    it('signs in once the code is right, and ends the challenge', async () => {
      const { twoFactorService, endChallenge } = makeTwoFactorService({
        findChallengeOwner: jest.fn().mockResolvedValue(twoFactorUser),
        checkCode: jest
          .fn()
          .mockResolvedValue({ ok: true, usedRecoveryCode: false }),
      });
      const { loginAttemptTracker, reset } = makeLoginAttemptTracker();
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        twoFactorService,
        loginAttemptTracker,
        auditLogService,
      });
      const { response, cookie, clearCookie } = makeResponse();

      await service.verifyTwoFactorLogin(
        { code: '123456' },
        makeRequest('two_factor_challenge=the-challenge'),
        response,
      );

      expect(endChallenge).toHaveBeenCalledWith('user-1');
      expect(clearCookie).toHaveBeenCalledWith(
        'two_factor_challenge',
        expect.anything(),
      );
      expect(reset).toHaveBeenCalledWith('jane@acme.test');
      expect(cookie).toHaveBeenCalledWith(
        'access_token',
        'signed.jwt.token',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'login',
          metadata: { twoFactor: true, usedRecoveryCode: false },
        }),
      );
    });

    it('refuses a wrong code and counts it like a wrong password', async () => {
      const { twoFactorService } = makeTwoFactorService({
        findChallengeOwner: jest.fn().mockResolvedValue(twoFactorUser),
      });
      const { loginAttemptTracker, recordFailure } = makeLoginAttemptTracker();
      const service = makeService({ twoFactorService, loginAttemptTracker });
      const { response, cookie } = makeResponse();

      await expect(
        service.verifyTwoFactorLogin(
          { code: '000000' },
          makeRequest('two_factor_challenge=the-challenge'),
          response,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(recordFailure).toHaveBeenCalledWith('jane@acme.test');
      expect(cookie).not.toHaveBeenCalled();
    });

    it('throws the challenge away once wrong codes call for a captcha', async () => {
      const { twoFactorService, endChallenge } = makeTwoFactorService({
        findChallengeOwner: jest.fn().mockResolvedValue(twoFactorUser),
      });
      const { loginAttemptTracker, requiresCaptcha } =
        makeLoginAttemptTracker();
      requiresCaptcha.mockReturnValueOnce(false).mockReturnValue(true);
      const service = makeService({ twoFactorService, loginAttemptTracker });

      const error: unknown = await service
        .verifyTwoFactorLogin(
          { code: '000000' },
          makeRequest('two_factor_challenge=the-challenge'),
          makeResponse().response,
        )
        .catch((caught: unknown) => caught);

      expect(endChallenge).toHaveBeenCalledWith('user-1');
      expect((error as { getResponse(): unknown }).getResponse()).toMatchObject(
        { captchaRequired: true, restart: true },
      );
    });

    it('sends the person back to the password when the challenge has expired', async () => {
      const { twoFactorService, checkCode } = makeTwoFactorService();
      const service = makeService({ twoFactorService });

      await expect(
        service.verifyTwoFactorLogin(
          { code: '123456' },
          makeRequest('two_factor_challenge=stale'),
          makeResponse().response,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(checkCode).not.toHaveBeenCalled();
    });

    it('does not sign in after a password reset, so the inbox alone is not enough', async () => {
      const user = {
        ...twoFactorUser,
        passwordResetToken: 'valid-token',
        passwordResetExpiresAt: new Date(Date.now() + 60_000),
      } as User;
      const { refreshTokenService, issue, revokeAll } =
        makeRefreshTokenService();
      const service = makeService({
        usersRepo: makeUsersRepo({
          findOne: jest.fn().mockResolvedValue(user),
        }),
        refreshTokenService,
      });
      const { response, cookie } = makeResponse();

      const result = await service.resetPassword(
        { token: 'valid-token', password: 'correct-horse' },
        response,
      );

      expect(revokeAll).toHaveBeenCalledWith(expect.anything(), 'user-1');
      expect(issue).not.toHaveBeenCalled();
      expect(cookie).not.toHaveBeenCalled();
      expect(result.twoFactorRequired).toBe(true);
    });

    describe('trusted browsers', () => {
      it('skips the code on a browser this person told not to ask again', async () => {
        const { twoFactorService, isTrustedBrowser, startChallenge } =
          makeTwoFactorService();
        isTrustedBrowser.mockResolvedValue(true);
        const { loginAttemptTracker, reset } = makeLoginAttemptTracker();
        const { auditLogService, record } = makeAuditLogService();
        const service = makeService({
          usersRepo: makeUsersRepo({
            findOne: jest.fn().mockResolvedValue(twoFactorUser),
          }),
          passwordService: makePasswordService({
            verify: jest.fn().mockResolvedValue(true),
          }),
          twoFactorService,
          loginAttemptTracker,
          auditLogService,
        });
        const { response, cookie } = makeResponse();

        const result = await service.login(
          { email: 'jane@acme.test', password: 'correct-horse' },
          makeRequest('two_factor_trusted_browser=the-trust-token'),
          response,
        );

        expect(result.twoFactorRequired).toBeUndefined();
        expect(isTrustedBrowser).toHaveBeenCalledWith(
          'user-1',
          'the-trust-token',
        );
        expect(startChallenge).not.toHaveBeenCalled();
        expect(cookie).toHaveBeenCalledWith(
          'access_token',
          'signed.jwt.token',
          expect.anything(),
        );
        expect(reset).toHaveBeenCalledWith('jane@acme.test');
        expect(record).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            action: 'login',
            metadata: { twoFactor: true, trustedBrowser: true },
          }),
        );
      });

      it('still asks for a code on a browser that is not trusted', async () => {
        const { twoFactorService, isTrustedBrowser, startChallenge } =
          makeTwoFactorService();
        const service = makeService({
          usersRepo: makeUsersRepo({
            findOne: jest.fn().mockResolvedValue(twoFactorUser),
          }),
          passwordService: makePasswordService({
            verify: jest.fn().mockResolvedValue(true),
          }),
          twoFactorService,
        });

        const result = await service.login(
          { email: 'jane@acme.test', password: 'correct-horse' },
          makeRequest(),
          makeResponse().response,
        );

        expect(isTrustedBrowser).toHaveBeenCalledWith('user-1', undefined);
        expect(startChallenge).toHaveBeenCalledWith('user-1');
        expect(result.twoFactorRequired).toBe(true);
      });

      it('remembers the browser after a right code when asked to', async () => {
        const { twoFactorService, trustBrowser } = makeTwoFactorService({
          findChallengeOwner: jest.fn().mockResolvedValue(twoFactorUser),
          checkCode: jest
            .fn()
            .mockResolvedValue({ ok: true, usedRecoveryCode: false }),
        });
        const service = makeService({ twoFactorService });
        const { response, cookie } = makeResponse();

        await service.verifyTwoFactorLogin(
          { code: '123456', rememberBrowser: true },
          makeRequest('two_factor_challenge=the-challenge'),
          response,
        );

        expect(trustBrowser).toHaveBeenCalledWith('user-1');
        expect(cookie).toHaveBeenCalledWith(
          'two_factor_trusted_browser',
          'the-trust-token',
          expect.objectContaining({
            httpOnly: true,
            maxAge: 30 * 24 * 60 * 60 * 1000,
          }),
        );
      });

      it('does not remember the browser unless asked to', async () => {
        const { twoFactorService, trustBrowser } = makeTwoFactorService({
          findChallengeOwner: jest.fn().mockResolvedValue(twoFactorUser),
          checkCode: jest
            .fn()
            .mockResolvedValue({ ok: true, usedRecoveryCode: false }),
        });
        const service = makeService({ twoFactorService });
        const { response, cookie } = makeResponse();

        await service.verifyTwoFactorLogin(
          { code: '123456' },
          makeRequest('two_factor_challenge=the-challenge'),
          response,
        );

        expect(trustBrowser).not.toHaveBeenCalled();
        expect(cookie).not.toHaveBeenCalledWith(
          'two_factor_trusted_browser',
          expect.anything(),
          expect.anything(),
        );
      });

      it('forgets every trusted browser on a password reset', async () => {
        const { twoFactorService, forgetTrustedBrowsers } =
          makeTwoFactorService();
        const service = makeService({
          usersRepo: makeUsersRepo({
            findOne: jest.fn().mockResolvedValue({
              ...twoFactorUser,
              passwordResetToken: 'valid-token',
              passwordResetExpiresAt: new Date(Date.now() + 60_000),
            }),
          }),
          twoFactorService,
        });

        await service.resetPassword(
          { token: 'valid-token', password: 'correct-horse' },
          makeResponse().response,
        );

        expect(forgetTrustedBrowsers).toHaveBeenCalledWith(
          expect.anything(),
          'user-1',
        );
      });

      it('forgets every trusted browser when signing out everywhere, but not on an ordinary log out', async () => {
        const { twoFactorService, forgetTrustedBrowsers } =
          makeTwoFactorService();
        const service = makeService({ twoFactorService });
        const everywhere = makeResponse();

        await service.logout(
          makeRequest('refresh_token=the-refresh-token'),
          makeResponse().response,
        );
        expect(forgetTrustedBrowsers).not.toHaveBeenCalled();

        await service.logoutEverywhere(
          makeRequest('refresh_token=the-refresh-token'),
          everywhere.response,
        );
        expect(forgetTrustedBrowsers).toHaveBeenCalledWith(
          expect.anything(),
          'user-1',
        );
        expect(everywhere.clearCookie).toHaveBeenCalledWith(
          'two_factor_trusted_browser',
          expect.anything(),
        );
      });
    });

    it('restarting the web session signs out every other browser and keeps this one', async () => {
      const { refreshTokenService, revokeAll, issue } =
        makeRefreshTokenService();
      const { accessTokenService, endAllSessions, sign } =
        makeAccessTokenService();
      const service = makeService({ refreshTokenService, accessTokenService });
      const { response, cookie } = makeResponse();

      await service.restartWebSession('user-1', response);

      expect(revokeAll).toHaveBeenCalledWith(expect.anything(), 'user-1');
      expect(endAllSessions).toHaveBeenCalledWith(expect.anything(), 'user-1');
      expect(issue).toHaveBeenCalledWith(expect.anything(), 'user-1');
      expect(sign.mock.invocationCallOrder[0]).toBeGreaterThan(
        endAllSessions.mock.invocationCallOrder[0],
      );
      expect(cookie).toHaveBeenCalledWith(
        'refresh_token',
        'the-refresh-token',
        expect.anything(),
      );
    });
  });
});
