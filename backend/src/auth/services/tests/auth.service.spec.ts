import {
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { User } from '../../../database/entities/user.entity';
import { EmailService } from '../../../email/services/email.service';
import { OrganisationsService } from '../../../organisations/services/organisations.service';
import { AuthService } from '../auth.service';
import { PasswordService } from '../password.service';
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

  function makeDataSource() {
    const manager = { update: jest.fn() } as unknown as EntityManager;
    const transaction = jest.fn(
      (fn: (manager: EntityManager) => Promise<void>) => fn(manager),
    );
    return { dataSource: { transaction } as unknown, manager, transaction };
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
      generateEmailVerificationToken: jest.fn().mockReturnValue('the-token'),
      signAccessToken: jest.fn().mockReturnValue('signed.jwt.token'),
      ...overrides,
    } as unknown as TokenService;
  }

  function makeEmailService() {
    const sendSetPasswordEmail = jest.fn().mockResolvedValue(undefined);
    const sendDuplicateRegistrationNotice = jest
      .fn()
      .mockResolvedValue(undefined);
    const emailService = {
      sendSetPasswordEmail,
      sendDuplicateRegistrationNotice,
    } as unknown as EmailService;
    return {
      emailService,
      sendSetPasswordEmail,
      sendDuplicateRegistrationNotice,
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
      const { organisationsService } = makeOrganisationsService();
      const service = new AuthService(
        usersRepo,
        makeDataSource().dataSource as never,
        makeConfigService(),
        makePasswordService(),
        makeTokenService(),
        emailService,
        organisationsService,
      );

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
      const service = new AuthService(
        usersRepo,
        makeDataSource().dataSource as never,
        makeConfigService(),
        makePasswordService(),
        makeTokenService(),
        emailService,
        makeOrganisationsService().organisationsService,
      );

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
      const service = new AuthService(
        usersRepo,
        makeDataSource().dataSource as never,
        makeConfigService(),
        makePasswordService(),
        makeTokenService(),
        emailService,
        makeOrganisationsService().organisationsService,
      );

      const result = await service.signUp(signUpInput);

      expect(sendDuplicateRegistrationNotice).toHaveBeenCalledWith(
        'jane@acme.test',
      );
      expect(result.message).toContain('Check your email');
    });
  });

  describe('resendVerificationEmail', () => {
    function makeService(
      usersRepo: Repository<User>,
      emailService: EmailService,
    ) {
      return new AuthService(
        usersRepo,
        makeDataSource().dataSource as never,
        makeConfigService(),
        makePasswordService(),
        makeTokenService(),
        emailService,
        makeOrganisationsService().organisationsService,
      );
    }

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
      const service = makeService(usersRepo, emailService);

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
      const service = makeService(usersRepo, emailService);

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
      const service = makeService(usersRepo, emailService);

      const result = await service.resendVerificationEmail({
        email: 'jane@acme.test',
      });

      expect(sendSetPasswordEmail).not.toHaveBeenCalled();
      expect(result.message).toContain("we've sent a new link");
    });
  });

  describe('setPassword', () => {
    function makeService(
      usersRepo: Repository<User>,
      organisationsService = makeOrganisationsService().organisationsService,
    ) {
      return new AuthService(
        usersRepo,
        makeDataSource().dataSource as never,
        makeConfigService(),
        makePasswordService(),
        makeTokenService(),
        makeEmailService().emailService,
        organisationsService,
      );
    }

    it('hashes the password, marks the email verified, creates the pending organisation and logs the user in', async () => {
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
      const service = new AuthService(
        usersRepo,
        makeDataSource().dataSource as never,
        makeConfigService(),
        makePasswordService(),
        makeTokenService(),
        makeEmailService().emailService,
        organisationsService,
      );
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
      expect(cookie).toHaveBeenCalledWith(
        'access_token',
        'signed.jwt.token',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(result.message).toContain('signed in');
    });

    it('rejects an unknown token', async () => {
      const findOne = jest.fn().mockResolvedValue(null);
      const service = makeService(makeUsersRepo({ findOne }));

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
      const service = makeService(makeUsersRepo({ findOne }));

      await expect(
        service.setPassword(
          { token: 'expired-token', password: 'correct-horse' },
          makeResponse().response,
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  describe('login', () => {
    function makeService(
      usersRepo: Repository<User>,
      passwordService: PasswordService,
    ) {
      return new AuthService(
        usersRepo,
        makeDataSource().dataSource as never,
        makeConfigService(),
        passwordService,
        makeTokenService(),
        makeEmailService().emailService,
        makeOrganisationsService().organisationsService,
      );
    }

    it('verifies the password, sets the session cookie and returns a success message', async () => {
      const user = {
        id: 'user-1',
        passwordHash: 'stored-hash',
      } as User;
      const findOne = jest.fn().mockResolvedValue(user);
      const verify = jest.fn().mockResolvedValue(true);
      const service = makeService(
        makeUsersRepo({ findOne }),
        makePasswordService({ verify }),
      );
      const { response, cookie } = makeResponse();

      const result = await service.login(
        { email: 'jane@acme.test', password: 'correct-horse' },
        response,
      );

      expect(verify).toHaveBeenCalledWith('stored-hash', 'correct-horse');
      expect(cookie).toHaveBeenCalledWith(
        'access_token',
        'signed.jwt.token',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(result.message).toContain('Logged in');
    });

    it('rejects an unknown email with the generic invalid-login message', async () => {
      const findOne = jest.fn().mockResolvedValue(null);
      const verify = jest.fn().mockResolvedValue(false);
      const service = makeService(
        makeUsersRepo({ findOne }),
        makePasswordService({ verify }),
      );

      await expect(
        service.login(
          { email: 'unknown@acme.test', password: 'whatever' },
          makeResponse().response,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(verify).toHaveBeenCalled();
    });

    it('rejects a wrong password with the generic invalid-login message', async () => {
      const user = {
        id: 'user-1',
        passwordHash: 'stored-hash',
      } as User;
      const findOne = jest.fn().mockResolvedValue(user);
      const verify = jest.fn().mockResolvedValue(false);
      const service = makeService(
        makeUsersRepo({ findOne }),
        makePasswordService({ verify }),
      );

      await expect(
        service.login(
          { email: 'jane@acme.test', password: 'wrong-password' },
          makeResponse().response,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a user who never finished setting a password', async () => {
      const user = {
        id: 'user-1',
        passwordHash: null,
      } as User;
      const findOne = jest.fn().mockResolvedValue(user);
      const verify = jest.fn().mockResolvedValue(false);
      const service = makeService(
        makeUsersRepo({ findOne }),
        makePasswordService({ verify }),
      );

      await expect(
        service.login(
          { email: 'jane@acme.test', password: 'whatever' },
          makeResponse().response,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('clears the access-token cookie', () => {
      const service = new AuthService(
        makeUsersRepo(),
        makeDataSource().dataSource as never,
        makeConfigService(),
        makePasswordService(),
        makeTokenService(),
        makeEmailService().emailService,
        makeOrganisationsService().organisationsService,
      );
      const { response, clearCookie } = makeResponse();

      const result = service.logout(response);

      expect(clearCookie).toHaveBeenCalledWith(
        'access_token',
        expect.objectContaining({ path: '/' }),
      );
      expect(result.message).toContain('Logged out');
    });
  });
});
