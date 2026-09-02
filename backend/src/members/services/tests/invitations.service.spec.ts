import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { EntityManager, Repository } from 'typeorm';
import { AuditLogService } from '../../../audit-log/services/audit-log.service';
import { PasswordService } from '../../../auth/services/password.service';
import { RefreshTokenService } from '../../../auth/services/refresh-token.service';
import { TokenService } from '../../../auth/services/token.service';
import { hashToken } from '../../../common/hash-token.util';
import { Invitation } from '../../../database/entities/invitation.entity';
import { InvitationStatus } from '../../../database/entities/invitation-status.enum';
import { Membership } from '../../../database/entities/membership.entity';
import { MembershipRole } from '../../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../../database/entities/membership-status.enum';
import { Organisation } from '../../../database/entities/organisation.entity';
import { User } from '../../../database/entities/user.entity';
import { EmailService } from '../../../email/services/email.service';
import { InvitationsService } from '../invitations.service';

describe('InvitationsService', () => {
  const organisation = { id: 'org-1', name: 'Acme Inc' } as Organisation;

  function makeInvitationsRepo(
    overrides: Partial<Repository<Invitation>> = {},
  ) {
    return {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      ...overrides,
    } as unknown as Repository<Invitation>;
  }

  function makeMembershipsRepo(getOneResult: unknown = null) {
    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(getOneResult),
    };
    return {
      repo: {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      } as unknown as Repository<Membership>,
      queryBuilder,
    };
  }

  function makeUsersRepo(overrides: Partial<Repository<User>> = {}) {
    return {
      findOne: jest.fn().mockResolvedValue(null),
      ...overrides,
    } as unknown as Repository<User>;
  }

  function makeOrganisationsRepo(
    overrides: Partial<Repository<Organisation>> = {},
  ) {
    return {
      findOneOrFail: jest.fn().mockResolvedValue(organisation),
      ...overrides,
    } as unknown as Repository<Organisation>;
  }

  type TransactionFn = (manager: EntityManager) => Promise<unknown>;

  function makeDataSource() {
    const create = jest.fn(
      (_entity: unknown, data: Record<string, unknown>) => data,
    );
    const save = jest.fn((entity: Record<string, unknown>) =>
      Promise.resolve({ id: 'new-id', ...entity }),
    );
    const update = jest.fn().mockResolvedValue(undefined);
    const manager = { create, save, update } as unknown as EntityManager;
    const transaction = jest.fn((fn: TransactionFn) => fn(manager));
    return {
      dataSource: { transaction, manager } as unknown,
      manager,
      transaction,
      create,
      save,
      update,
    };
  }

  function makeConfigService(overrides: Record<string, unknown> = {}) {
    return {
      get: jest.fn(
        (key: string, defaultValue: unknown) => overrides[key] ?? defaultValue,
      ),
    } as unknown as ConfigService;
  }

  function makeJwtService(overrides: Partial<JwtService> = {}) {
    return { verify: jest.fn(), ...overrides } as unknown as JwtService;
  }

  function makeTokenService() {
    return {
      generateToken: jest.fn().mockReturnValue('the-token'),
      signAccessToken: jest.fn().mockReturnValue('signed.jwt.token'),
    } as unknown as TokenService;
  }

  function makePasswordService() {
    return {
      hash: jest.fn().mockResolvedValue('hashed-password'),
    } as unknown as PasswordService;
  }

  function makeRefreshTokenService() {
    const issue = jest.fn().mockResolvedValue('the-refresh-token');
    return {
      refreshTokenService: { issue } as unknown as RefreshTokenService,
      issue,
    };
  }

  function makeEmailService() {
    const sendInvitationEmail = jest.fn().mockResolvedValue(undefined);
    return {
      emailService: { sendInvitationEmail } as unknown as EmailService,
      sendInvitationEmail,
    };
  }

  function makeAuditLogService() {
    const record = jest.fn().mockResolvedValue(undefined);
    return {
      auditLogService: { record } as unknown as AuditLogService,
      record,
    };
  }

  function makeResponse() {
    const cookie = jest.fn();
    return { response: { cookie } as unknown as Response, cookie };
  }

  function makeRequest(cookieHeader?: string) {
    return { headers: { cookie: cookieHeader } } as unknown as Request;
  }

  function makeService(
    overrides: {
      invitationsRepo?: Repository<Invitation>;
      membershipsRepo?: Repository<Membership>;
      usersRepo?: Repository<User>;
      organisationsRepo?: Repository<Organisation>;
      dataSource?: unknown;
      configService?: ConfigService;
      jwtService?: JwtService;
      passwordService?: PasswordService;
      tokenService?: TokenService;
      refreshTokenService?: RefreshTokenService;
      emailService?: EmailService;
      auditLogService?: AuditLogService;
    } = {},
  ) {
    return new InvitationsService(
      overrides.invitationsRepo ?? makeInvitationsRepo(),
      overrides.membershipsRepo ?? makeMembershipsRepo().repo,
      overrides.usersRepo ?? makeUsersRepo(),
      overrides.organisationsRepo ?? makeOrganisationsRepo(),
      (overrides.dataSource ?? makeDataSource().dataSource) as never,
      overrides.configService ?? makeConfigService(),
      overrides.jwtService ?? makeJwtService(),
      overrides.passwordService ?? makePasswordService(),
      overrides.tokenService ?? makeTokenService(),
      overrides.refreshTokenService ??
        makeRefreshTokenService().refreshTokenService,
      overrides.emailService ?? makeEmailService().emailService,
      overrides.auditLogService ?? makeAuditLogService().auditLogService,
    );
  }

  describe('createMany', () => {
    it('reports an invalid entry without creating a row or sending an email', async () => {
      const { create, save } = makeDataSource();
      const { emailService, sendInvitationEmail } = makeEmailService();
      const service = makeService({
        dataSource: {
          transaction: jest.fn((fn: TransactionFn) =>
            fn({ create, save, update: jest.fn() } as unknown as EntityManager),
          ),
        },
        emailService,
      });

      const results = await service.createMany('org-1', 'admin-1', [
        { email: 'not-an-email', role: MembershipRole.MEMBER },
      ]);

      expect(results).toEqual([
        {
          email: 'not-an-email',
          outcome: 'invalid',
          message: 'Invalid email format.',
        },
      ]);
      expect(sendInvitationEmail).not.toHaveBeenCalled();
    });

    it('reports "already_member" and does not create an invitation for an existing active member', async () => {
      const { repo: membershipsRepo } = makeMembershipsRepo({
        id: 'membership-1',
      });
      const invitationsRepo = makeInvitationsRepo();
      const { emailService, sendInvitationEmail } = makeEmailService();
      const service = makeService({
        membershipsRepo,
        invitationsRepo,
        emailService,
      });

      const results = await service.createMany('org-1', 'admin-1', [
        { email: 'existing@acme.test', role: MembershipRole.MEMBER },
      ]);

      expect(results).toEqual([
        {
          email: 'existing@acme.test',
          outcome: 'already_member',
          message: 'This person is already a member of this organisation.',
        },
      ]);
      expect(sendInvitationEmail).not.toHaveBeenCalled();
    });

    it('creates a new pending invitation and emails it', async () => {
      const { dataSource, create, save } = makeDataSource();
      const invitationsRepo = makeInvitationsRepo();
      const { emailService, sendInvitationEmail } = makeEmailService();
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        dataSource,
        invitationsRepo,
        emailService,
        auditLogService,
      });

      const results = await service.createMany('org-1', 'admin-1', [
        {
          email: 'New@Acme.test',
          role: MembershipRole.MANAGER,
          teamId: 'team-1',
        },
      ]);

      expect(results).toEqual([{ email: 'new@acme.test', outcome: 'sent' }]);
      expect(create).toHaveBeenCalledWith(
        Invitation,
        expect.objectContaining({
          email: 'new@acme.test',
          role: MembershipRole.MANAGER,
          teamId: 'team-1',
          organisationId: 'org-1',
          status: InvitationStatus.PENDING,
          tokenHash: hashToken('the-token'),
        }),
      );
      expect(save).toHaveBeenCalled();
      expect(sendInvitationEmail).toHaveBeenCalledWith(
        'new@acme.test',
        'the-token',
        'Acme Inc',
      );
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'invitation.created' }),
      );
    });

    it('refreshes the existing row in place when a pending invitation already exists', async () => {
      const { dataSource, update } = makeDataSource();
      const invitationsRepo = makeInvitationsRepo({
        findOne: jest.fn().mockResolvedValue({
          id: 'invitation-1',
          email: 'pending@acme.test',
          teamId: null,
        }),
      });
      const { emailService, sendInvitationEmail } = makeEmailService();
      const service = makeService({
        dataSource,
        invitationsRepo,
        emailService,
      });

      const results = await service.createMany('org-1', 'admin-1', [
        { email: 'pending@acme.test', role: MembershipRole.MEMBER },
      ]);

      expect(results).toEqual([
        { email: 'pending@acme.test', outcome: 'resent' },
      ]);
      expect(update).toHaveBeenCalledWith(
        Invitation,
        'invitation-1',
        expect.objectContaining({ tokenHash: hashToken('the-token') }),
      );
      expect(sendInvitationEmail).toHaveBeenCalledWith(
        'pending@acme.test',
        'the-token',
        'Acme Inc',
      );
    });
  });

  describe('resend', () => {
    it('throws when the invitation does not belong to the organisation', async () => {
      const invitationsRepo = makeInvitationsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const service = makeService({ invitationsRepo });

      await expect(
        service.resend('org-1', 'invitation-1', 'admin-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('revives a revoked invitation in place instead of creating a duplicate row', async () => {
      const invitationsRepo = makeInvitationsRepo({
        findOne: jest.fn().mockResolvedValue({
          id: 'invitation-1',
          email: 'revoked@acme.test',
          role: MembershipRole.MEMBER,
          teamId: null,
          status: InvitationStatus.REVOKED,
        }),
      });
      const { dataSource, create, update } = makeDataSource();
      const { emailService, sendInvitationEmail } = makeEmailService();
      const service = makeService({
        invitationsRepo,
        dataSource,
        emailService,
      });

      const result = await service.resend('org-1', 'invitation-1', 'admin-1');

      expect(result).toEqual({ email: 'revoked@acme.test', outcome: 'resent' });
      expect(update).toHaveBeenCalledWith(
        Invitation,
        'invitation-1',
        expect.objectContaining({
          status: InvitationStatus.PENDING,
          tokenHash: hashToken('the-token'),
        }),
      );
      expect(create).not.toHaveBeenCalledWith(Invitation, expect.anything());
      expect(sendInvitationEmail).toHaveBeenCalledWith(
        'revoked@acme.test',
        'the-token',
        'Acme Inc',
      );
    });

    it('reports "already_member" instead of reviving an invitation whose invitee has since joined', async () => {
      const invitationsRepo = makeInvitationsRepo({
        findOne: jest.fn().mockResolvedValue({
          id: 'invitation-1',
          email: 'joined@acme.test',
          role: MembershipRole.MEMBER,
          teamId: null,
          status: InvitationStatus.PENDING,
        }),
      });
      const { repo: membershipsRepo } = makeMembershipsRepo({
        id: 'membership-1',
      });
      const { dataSource, update } = makeDataSource();
      const service = makeService({
        invitationsRepo,
        membershipsRepo,
        dataSource,
      });

      const result = await service.resend('org-1', 'invitation-1', 'admin-1');

      expect(result).toEqual({
        email: 'joined@acme.test',
        outcome: 'already_member',
        message: 'This person is already a member of this organisation.',
      });
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe('revoke', () => {
    it('marks a pending invitation revoked and records an audit log entry', async () => {
      const invitation = {
        id: 'invitation-1',
        status: InvitationStatus.PENDING,
        email: 'a@b.test',
      };
      const invitationsRepo = makeInvitationsRepo({
        findOne: jest.fn().mockResolvedValue(invitation),
      });
      const { dataSource, update } = makeDataSource();
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        invitationsRepo,
        dataSource,
        auditLogService,
      });

      await service.revoke('org-1', 'invitation-1', 'admin-1');

      expect(update).toHaveBeenCalledWith(
        Invitation,
        'invitation-1',
        expect.objectContaining({ status: InvitationStatus.REVOKED }),
      );
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'invitation.revoked' }),
      );
    });

    it('is a no-op for an already-revoked invitation', async () => {
      const invitation = {
        id: 'invitation-1',
        status: InvitationStatus.REVOKED,
      };
      const invitationsRepo = makeInvitationsRepo({
        findOne: jest.fn().mockResolvedValue(invitation),
      });
      const { dataSource, update } = makeDataSource();
      const service = makeService({ invitationsRepo, dataSource });

      await service.revoke('org-1', 'invitation-1', 'admin-1');

      expect(update).not.toHaveBeenCalled();
    });

    it('throws when trying to revoke an already-accepted invitation', async () => {
      const invitation = {
        id: 'invitation-1',
        status: InvitationStatus.ACCEPTED,
      };
      const invitationsRepo = makeInvitationsRepo({
        findOne: jest.fn().mockResolvedValue(invitation),
      });
      const service = makeService({ invitationsRepo });

      await expect(
        service.revoke('org-1', 'invitation-1', 'admin-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('listForOrganisation', () => {
    it('excludes accepted invitations and computes the effective status of the rest', async () => {
      const invitationsRepo = makeInvitationsRepo({
        find: jest.fn().mockResolvedValue([
          {
            id: 'i-1',
            email: 'a@b.test',
            role: MembershipRole.MEMBER,
            teamId: null,
            status: InvitationStatus.PENDING,
            expiresAt: new Date(Date.now() - 1000),
            createdAt: new Date(),
          },
          {
            id: 'i-2',
            email: 'c@d.test',
            role: MembershipRole.ADMIN,
            teamId: null,
            status: InvitationStatus.ACCEPTED,
            expiresAt: null,
            createdAt: new Date(),
          },
        ]),
      });
      const service = makeService({ invitationsRepo });

      const summaries = await service.listForOrganisation('org-1');

      expect(summaries).toHaveLength(1);
      expect(summaries[0]).toMatchObject({ id: 'i-1', status: 'expired' });
    });
  });

  describe('getPreview', () => {
    it('returns "not_found" for an unknown token', async () => {
      const service = makeService();

      await expect(service.getPreview('bad-token')).resolves.toEqual({
        status: 'not_found',
      });
    });

    it('flags accountAlreadyExists when a User with a password already has this email', async () => {
      const invitationsRepo = makeInvitationsRepo({
        findOne: jest.fn().mockResolvedValue({
          status: InvitationStatus.PENDING,
          expiresAt: null,
          email: 'invitee@acme.test',
          role: MembershipRole.MEMBER,
          organisation: { name: 'Acme Inc' },
          team: null,
        }),
      });
      const usersRepo = makeUsersRepo({
        findOne: jest.fn().mockResolvedValue({ passwordHash: 'hashed' }),
      });
      const service = makeService({ invitationsRepo, usersRepo });

      const preview = await service.getPreview('the-token');

      expect(preview).toMatchObject({
        status: 'pending',
        accountAlreadyExists: true,
        organisationName: 'Acme Inc',
      });
    });
  });

  describe('accept', () => {
    function pendingInvitation(overrides: Record<string, unknown> = {}) {
      return {
        id: 'invitation-1',
        email: 'invitee@acme.test',
        role: MembershipRole.MEMBER,
        teamId: 'team-1',
        organisationId: 'org-1',
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 60_000),
        organisation: { id: 'org-1', name: 'Acme Inc' },
        ...overrides,
      };
    }

    it('rejects an invalid or expired token', async () => {
      const invitationsRepo = makeInvitationsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const service = makeService({ invitationsRepo });

      await expect(
        service.accept('bad-token', {}, makeRequest(), makeResponse().response),
      ).rejects.toThrow('This link is invalid or has expired.');
    });

    it('creates a brand-new User + Membership, marks the invitation accepted, and logs the caller in', async () => {
      const invitationsRepo = makeInvitationsRepo({
        findOne: jest.fn().mockResolvedValue(pendingInvitation()),
      });
      const { dataSource, create, update } = makeDataSource();
      const { refreshTokenService, issue } = makeRefreshTokenService();
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        invitationsRepo,
        dataSource,
        refreshTokenService,
        auditLogService,
      });
      const { response, cookie } = makeResponse();

      const result = await service.accept(
        'the-token',
        { password: 'Password1', firstName: 'Jane', lastName: 'Doe' },
        makeRequest(),
        response,
      );

      expect(create).toHaveBeenCalledWith(
        User,
        expect.objectContaining({
          email: 'invitee@acme.test',
          name: 'Jane Doe',
          passwordHash: 'hashed-password',
        }),
      );
      expect(create).toHaveBeenCalledWith(
        Membership,
        expect.objectContaining({
          organisationId: 'org-1',
          role: MembershipRole.MEMBER,
          teamId: 'team-1',
          status: MembershipStatus.ACTIVE,
        }),
      );
      expect(update).toHaveBeenCalledWith(
        Invitation,
        'invitation-1',
        expect.objectContaining({ status: InvitationStatus.ACCEPTED }),
      );
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'membership.joined' }),
      );
      expect(issue).toHaveBeenCalled();
      expect(cookie).toHaveBeenCalled();
      expect(result.message).toContain('Acme Inc');
    });

    it('requires a password when the invited email has no existing account', async () => {
      const invitationsRepo = makeInvitationsRepo({
        findOne: jest.fn().mockResolvedValue(pendingInvitation()),
      });
      const service = makeService({ invitationsRepo });

      await expect(
        service.accept('the-token', {}, makeRequest(), makeResponse().response),
      ).rejects.toThrow('A password is required');
    });

    it('requires a first and last name when creating a brand-new account', async () => {
      const invitationsRepo = makeInvitationsRepo({
        findOne: jest.fn().mockResolvedValue(pendingInvitation()),
      });
      const service = makeService({ invitationsRepo });

      await expect(
        service.accept(
          'the-token',
          { password: 'Password1' },
          makeRequest(),
          makeResponse().response,
        ),
      ).rejects.toThrow('Your first and last name are required');
    });

    it('completes an unverified existing User (no passwordHash yet) instead of creating a second one', async () => {
      const invitationsRepo = makeInvitationsRepo({
        findOne: jest.fn().mockResolvedValue(pendingInvitation()),
      });
      const usersRepo = makeUsersRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ id: 'existing-user', passwordHash: null }),
      });
      const { dataSource, create, update } = makeDataSource();
      const service = makeService({ invitationsRepo, usersRepo, dataSource });

      await service.accept(
        'the-token',
        { password: 'Password1' },
        makeRequest(),
        makeResponse().response,
      );

      expect(update).toHaveBeenCalledWith(
        User,
        'existing-user',
        expect.objectContaining({ passwordHash: 'hashed-password' }),
      );
      expect(create).not.toHaveBeenCalledWith(User, expect.anything());
    });

    it('accepts without a password when the caller is already logged in as the invited email', async () => {
      const invitationsRepo = makeInvitationsRepo({
        findOne: jest.fn().mockResolvedValue(pendingInvitation()),
      });
      const usersRepo = makeUsersRepo({
        findOne: jest.fn().mockResolvedValue({
          id: 'existing-user',
          passwordHash: 'already-set',
        }),
      });
      const jwtService = makeJwtService({
        verify: jest.fn().mockReturnValue({ sub: 'existing-user' }),
      });
      const { dataSource, create } = makeDataSource();
      const { refreshTokenService, issue } = makeRefreshTokenService();
      const service = makeService({
        invitationsRepo,
        usersRepo,
        jwtService,
        dataSource,
        refreshTokenService,
      });
      const { response, cookie } = makeResponse();

      await service.accept(
        'the-token',
        {},
        makeRequest('access_token=valid.jwt.token'),
        response,
      );

      expect(create).toHaveBeenCalledWith(
        Membership,
        expect.objectContaining({ userId: 'existing-user' }),
      );
      expect(issue).not.toHaveBeenCalled();
      expect(cookie).not.toHaveBeenCalled();
    });

    it('rejects with ACCOUNT_EXISTS when the email already has an account and the caller is not logged in as it', async () => {
      const invitationsRepo = makeInvitationsRepo({
        findOne: jest.fn().mockResolvedValue(pendingInvitation()),
      });
      const usersRepo = makeUsersRepo({
        findOne: jest.fn().mockResolvedValue({
          id: 'existing-user',
          passwordHash: 'already-set',
        }),
      });
      const service = makeService({ invitationsRepo, usersRepo });

      await expect(
        service.accept('the-token', {}, makeRequest(), makeResponse().response),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'ACCOUNT_EXISTS',
        }) as unknown,
      });
    });
  });
});
