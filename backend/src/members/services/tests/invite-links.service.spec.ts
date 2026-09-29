import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { TokenService } from '../../../auth/services/token.service';
import { InviteLink } from '../../../database/entities/invite-link.entity';
import { Invitation } from '../../../database/entities/invitation.entity';
import { InvitationStatus } from '../../../database/entities/invitation-status.enum';
import { Membership } from '../../../database/entities/membership.entity';
import { MembershipRole } from '../../../database/entities/membership-role.enum';
import { Project } from '../../../database/entities/project.entity';
import { Team } from '../../../database/entities/team.entity';
import { InviteLinksService } from '../invite-links.service';
import { InvitationsService } from '../invitations.service';

describe('InviteLinksService', () => {
  const admin = {
    id: 'admin-membership',
    userId: 'admin-1',
    role: MembershipRole.ADMIN,
    teamMemberships: [],
  };
  const manager = {
    id: 'manager-membership',
    userId: 'manager-1',
    role: MembershipRole.MANAGER,
    teamMemberships: [
      { teamId: 'team-managed', isManager: true },
      { teamId: 'team-joined', isManager: false },
    ],
  };

  function requestedIds(options: unknown): string[] {
    const id = (options as { where?: { id?: { _value?: string[] } } })?.where
      ?.id;
    return id?._value ?? [];
  }

  function makeService(
    overrides: {
      caller?: unknown;
      inviteLinksRepo?: Partial<Repository<InviteLink>>;
      teamsCount?: jest.Mock;
      projectsCount?: jest.Mock;
      requestViaInviteLink?: jest.Mock;
    } = {},
  ) {
    const save = jest.fn((entity: Record<string, unknown>) =>
      Promise.resolve({ id: 'link-new', createdAt: new Date(), ...entity }),
    );
    const create = jest.fn(
      (_entity: unknown, data: Record<string, unknown>) => data,
    );
    const update = jest.fn().mockResolvedValue(undefined);
    const del = jest.fn().mockResolvedValue(undefined);
    const manager = {
      save,
      create,
      update,
      delete: del,
    } as unknown as EntityManager;
    const record = jest.fn().mockResolvedValue(undefined);
    const requestViaInviteLink =
      overrides.requestViaInviteLink ?? jest.fn().mockResolvedValue(undefined);
    const inviteLinksRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      ...overrides.inviteLinksRepo,
    };

    const service = new InviteLinksService(
      inviteLinksRepo as unknown as Repository<InviteLink>,
      {
        findOne: jest.fn().mockResolvedValue(overrides.caller ?? admin),
      } as unknown as Repository<Membership>,
      {
        count:
          overrides.teamsCount ??
          jest.fn((options: unknown) =>
            Promise.resolve(requestedIds(options).length),
          ),
        find: jest.fn().mockResolvedValue([]),
      } as unknown as Repository<Team>,
      {
        count:
          overrides.projectsCount ??
          jest.fn((options: unknown) =>
            Promise.resolve(requestedIds(options).length),
          ),
      } as unknown as Repository<Project>,
      {
        transaction: jest.fn((fn: (m: EntityManager) => Promise<unknown>) =>
          fn(manager),
        ),
      } as never,
      {
        generateToken: jest.fn().mockReturnValue('link-token'),
      } as unknown as TokenService,
      { record },
      { requestViaInviteLink } as unknown as InvitationsService,
    );

    return {
      service,
      inviteLinksRepo,
      save,
      update,
      del,
      record,
      requestViaInviteLink,
    };
  }

  const createDto = {
    name: 'Onboarding',
    role: MembershipRole.MEMBER,
    teamIds: ['team-managed'],
    projectIds: ['project-1'],
  };

  describe('create', () => {
    it('stores a fresh token and the creator, and audits it', async () => {
      const { service, save, record } = makeService();

      const summary = await service.create('org-1', 'admin-1', createDto);

      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: 'org-1',
          token: 'link-token',
          createdByUserId: 'admin-1',
          enabled: true,
          usageCap: null,
          expiresAt: null,
        }),
      );
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'invite_link.created' }),
      );
      expect(summary.status).toBe('active');
    });

    it("rejects a team that isn't in the organisation", async () => {
      const { service } = makeService({
        teamsCount: jest.fn().mockResolvedValue(0),
      });

      await expect(
        service.create('org-1', 'admin-1', createDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a missing or archived project', async () => {
      const { service } = makeService({
        projectsCount: jest.fn().mockResolvedValue(0),
      });

      await expect(
        service.create('org-1', 'admin-1', createDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects a manager attaching a team they don't manage", async () => {
      const { service, save } = makeService({ caller: manager });

      await expect(
        service.create('org-1', 'manager-1', {
          ...createDto,
          teamIds: ['team-managed', 'team-joined'],
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(save).not.toHaveBeenCalled();
    });

    it('lets a manager attach teams they manage', async () => {
      const { service } = makeService({ caller: manager });

      await expect(
        service.create('org-1', 'manager-1', createDto),
      ).resolves.toMatchObject({ name: 'Onboarding' });
    });
  });

  describe('list', () => {
    it('shows a manager only the links they created', async () => {
      const find = jest.fn().mockResolvedValue([]);
      const { service } = makeService({
        caller: manager,
        inviteLinksRepo: { find },
      });

      await service.list('org-1', 'manager-1');

      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organisationId: 'org-1', createdByUserId: 'manager-1' },
        }),
      );
    });

    it('shows an admin every link in the organisation', async () => {
      const find = jest.fn().mockResolvedValue([]);
      const { service } = makeService({ inviteLinksRepo: { find } });

      await service.list('org-1', 'admin-1');

      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organisationId: 'org-1' } }),
      );
    });
  });

  describe('remove', () => {
    it("revokes the link's pending invitations and deletes it", async () => {
      const { service, update, del } = makeService({
        inviteLinksRepo: {
          findOne: jest.fn().mockResolvedValue({ id: 'link-1' }),
        },
      });

      await service.remove('org-1', 'link-1', 'admin-1');

      expect(update).toHaveBeenCalledWith(
        Invitation,
        {
          organisationId: 'org-1',
          inviteLinkId: 'link-1',
          status: InvitationStatus.PENDING,
        },
        { status: InvitationStatus.REVOKED },
      );
      expect(del).toHaveBeenCalledWith(InviteLink, {
        id: 'link-1',
        organisationId: 'org-1',
      });
    });

    it("hides another person's link from a manager", async () => {
      const findOne = jest.fn().mockResolvedValue(null);
      const { service } = makeService({
        caller: manager,
        inviteLinksRepo: { findOne },
      });

      await expect(
        service.remove('org-1', 'link-1', 'manager-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(findOne).toHaveBeenCalledWith({
        where: {
          id: 'link-1',
          organisationId: 'org-1',
          createdByUserId: 'manager-1',
        },
      });
    });
  });

  describe('requestJoin', () => {
    const activeLink = {
      id: 'link-1',
      enabled: true,
      expiresAt: null,
      usageCap: null,
      usageCount: 0,
    };

    it('hands an active link to the invitation flow', async () => {
      const { service, requestViaInviteLink } = makeService({
        inviteLinksRepo: { findOne: jest.fn().mockResolvedValue(activeLink) },
      });

      await service.requestJoin('link-token', 'a@acme.test');

      expect(requestViaInviteLink).toHaveBeenCalledWith(
        activeLink,
        'a@acme.test',
      );
    });

    it.each([
      ['unknown', null],
      ['disabled', { ...activeLink, enabled: false }],
      ['expired', { ...activeLink, expiresAt: new Date('2020-01-01') }],
      ['full', { ...activeLink, usageCap: 2, usageCount: 2 }],
    ])('sends nothing for a %s link', async (_label, link) => {
      const { service, requestViaInviteLink } = makeService({
        inviteLinksRepo: { findOne: jest.fn().mockResolvedValue(link) },
      });

      await service.requestJoin('link-token', 'a@acme.test');

      expect(requestViaInviteLink).not.toHaveBeenCalled();
    });
  });

  describe('getPreview', () => {
    it('reports an unknown token as not_found', async () => {
      const { service } = makeService();
      await expect(service.getPreview('nope')).resolves.toEqual({
        status: 'not_found',
      });
    });
  });
});
