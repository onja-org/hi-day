import { ConflictException, NotFoundException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { AuditLogService } from '../../../audit-log/services/audit-log.service';
import { Membership } from '../../../database/entities/membership.entity';
import { ForbiddenException } from '@nestjs/common';
import { MembershipRole } from '../../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../../database/entities/membership-status.enum';
import { Team } from '../../../database/entities/team.entity';
import { TeamMembership } from '../../../database/entities/team-membership.entity';
import { TeamsService } from '../teams.service';

describe('TeamsService', () => {
  function makeTeamsRepo(overrides: Partial<Repository<Team>> = {}) {
    return {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(2),
      ...overrides,
    } as unknown as Repository<Team>;
  }

  function makeTeamMembershipsRepo(
    overrides: Partial<Repository<TeamMembership>> = {},
  ) {
    return {
      findOne: jest.fn().mockResolvedValue(null),
      ...overrides,
    } as unknown as Repository<TeamMembership>;
  }

  function makeMembershipsRepo(
    overrides: Partial<Repository<Membership>> = {},
  ) {
    return {
      findOne: jest.fn(),
      ...overrides,
    } as unknown as Repository<Membership>;
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
    const del = jest.fn().mockResolvedValue(undefined);
    const manager = {
      create,
      save,
      update,
      delete: del,
    } as unknown as EntityManager;
    const transaction = jest.fn((fn: TransactionFn) => fn(manager));
    return {
      dataSource: { transaction } as unknown,
      manager,
      transaction,
      create,
      save,
      update,
      delete: del,
    };
  }

  function makeAuditLogService() {
    const record = jest.fn().mockResolvedValue(undefined);
    return {
      auditLogService: { record } as unknown as AuditLogService,
      record,
    };
  }

  function makeService(
    overrides: {
      teamsRepo?: Repository<Team>;
      teamMembershipsRepo?: Repository<TeamMembership>;
      membershipsRepo?: Repository<Membership>;
      dataSource?: unknown;
      auditLogService?: AuditLogService;
    } = {},
  ) {
    return new TeamsService(
      overrides.teamsRepo ?? makeTeamsRepo(),
      overrides.teamMembershipsRepo ?? makeTeamMembershipsRepo(),
      overrides.membershipsRepo ?? makeMembershipsRepo(),
      (overrides.dataSource ?? makeDataSource().dataSource) as never,
      overrides.auditLogService ?? makeAuditLogService().auditLogService,
    );
  }

  describe('setMembersActivityVisibility', () => {
    const team = { id: 'team-1', name: 'Design', organisationId: 'org-1' };

    function member(id: string, extra: Partial<Membership> = {}): Membership {
      return {
        id,
        organisationId: 'org-1',
        userId: `user-${id}`,
        role: MembershipRole.MEMBER,
        status: MembershipStatus.ACTIVE,
        teamMemberships: [],
        ...extra,
      } as unknown as Membership;
    }

    /** Captures what the UPDATE was told to set, and on whom. */
    function makeUpdating(members: Membership[], caller: Membership) {
      const captured: { set?: unknown; ids?: string[] } = {};
      // Typed up front so the arrows below can return `builder` without it
      // resolving to `any` through its own circular inference.
      const builder: {
        update: jest.Mock;
        set: jest.Mock;
        whereInIds: jest.Mock;
        execute: jest.Mock;
      } = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn((value: unknown) => {
          captured.set = value;
          return builder;
        }),
        whereInIds: jest.fn((ids: string[]) => {
          captured.ids = ids;
          return builder;
        }),
        execute: jest.fn().mockResolvedValue({ affected: members.length }),
      };
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(caller),
        createQueryBuilder: jest.fn().mockReturnValue(builder),
      });
      const teamMembershipsRepo = makeTeamMembershipsRepo({
        find: jest
          .fn()
          .mockResolvedValue(members.map((m) => ({ membership: m }))),
      });
      const teamsRepo = makeTeamsRepo({
        findOne: jest.fn().mockResolvedValue(team),
      });
      return { captured, membershipsRepo, teamMembershipsRepo, teamsRepo };
    }

    it('hides activity for every plain member of the team in one update', async () => {
      const caller = member('admin-1', { role: MembershipRole.ADMIN });
      const members = [member('m-1'), member('m-2')];
      const { captured, ...repos } = makeUpdating([...members, caller], caller);
      const service = makeService(repos);

      const result = await service.setMembersActivityVisibility(
        'org-1',
        'team-1',
        'user-admin-1',
        false,
      );

      expect(result).toEqual({ updated: 2 });
      expect(captured.set).toEqual({ canViewOwnActivity: false });
      expect(captured.ids).toEqual(['m-1', 'm-2']);
    });

    it('clears the overrides so everyone inherits the organisation default', async () => {
      const caller = member('admin-1', { role: MembershipRole.ADMIN });
      const { captured, ...repos } = makeUpdating([member('m-1')], caller);
      const service = makeService(repos);

      await service.setMembersActivityVisibility(
        'org-1',
        'team-1',
        'user-admin-1',
        null,
      );

      expect(captured.set).toEqual({ canViewOwnActivity: null });
    });

    it('never touches an admin — the setting does nothing for them', async () => {
      const caller = member('admin-1', { role: MembershipRole.ADMIN });
      const otherAdmin = member('admin-2', { role: MembershipRole.ADMIN });
      const { captured, ...repos } = makeUpdating(
        [member('m-1'), otherAdmin],
        caller,
      );
      const service = makeService(repos);

      const result = await service.setMembersActivityVisibility(
        'org-1',
        'team-1',
        'user-admin-1',
        false,
      );

      expect(captured.ids).toEqual(['m-1']);
      expect(result).toEqual({ updated: 1 });
    });

    it('never touches someone who manages a team — they always see their own', async () => {
      const caller = member('admin-1', { role: MembershipRole.ADMIN });
      const teamManager = member('mgr-1', {
        teamMemberships: [
          { teamId: 'team-1', isManager: true },
        ] as unknown as Membership['teamMemberships'],
      });
      const { captured, ...repos } = makeUpdating(
        [member('m-1'), teamManager],
        caller,
      );
      const service = makeService(repos);

      await service.setMembersActivityVisibility(
        'org-1',
        'team-1',
        'user-admin-1',
        false,
      );

      expect(captured.ids).toEqual(['m-1']);
    });

    it('never includes the caller, so applying to everyone cannot hide your own', async () => {
      const caller = member('mgr-1', {
        teamMemberships: [
          { teamId: 'team-1', isManager: true },
        ] as unknown as Membership['teamMemberships'],
      });
      const { captured, ...repos } = makeUpdating(
        [member('m-1'), caller],
        caller,
      );
      const service = makeService(repos);

      await service.setMembersActivityVisibility(
        'org-1',
        'team-1',
        'user-mgr-1',
        false,
      );

      expect(captured.ids).toEqual(['m-1']);
    });

    it('skips inactive members', async () => {
      const caller = member('admin-1', { role: MembershipRole.ADMIN });
      const left = member('m-2', { status: MembershipStatus.DEACTIVATED });
      const { captured, ...repos } = makeUpdating(
        [member('m-1'), left],
        caller,
      );
      const service = makeService(repos);

      await service.setMembersActivityVisibility(
        'org-1',
        'team-1',
        'user-admin-1',
        false,
      );

      expect(captured.ids).toEqual(['m-1']);
    });

    it('refuses a caller who neither runs the org nor manages this team', async () => {
      const caller = member('m-9');
      const repos = makeUpdating([member('m-1')], caller);
      const service = makeService(repos);

      await expect(
        service.setMembersActivityVisibility(
          'org-1',
          'team-1',
          'user-m-9',
          false,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("lets this team's own manager apply it", async () => {
      const caller = member('mgr-1', {
        teamMemberships: [
          { teamId: 'team-1', isManager: true },
        ] as unknown as Membership['teamMemberships'],
      });
      const { captured, ...repos } = makeUpdating(
        [member('m-1'), caller],
        caller,
      );
      const service = makeService(repos);

      await expect(
        service.setMembersActivityVisibility(
          'org-1',
          'team-1',
          'user-mgr-1',
          false,
        ),
      ).resolves.toEqual({ updated: 1 });
      expect(captured.ids).toEqual(['m-1']);
    });

    it('refuses a manager of a different team', async () => {
      const caller = member('mgr-2', {
        teamMemberships: [
          { teamId: 'team-OTHER', isManager: true },
        ] as unknown as Membership['teamMemberships'],
      });
      const repos = makeUpdating([member('m-1')], caller);
      const service = makeService(repos);

      await expect(
        service.setMembersActivityVisibility(
          'org-1',
          'team-1',
          'user-mgr-2',
          false,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('writes nothing and records nothing when the team has no plain members', async () => {
      const caller = member('admin-1', { role: MembershipRole.ADMIN });
      const { auditLogService, record } = makeAuditLogService();
      const repos = makeUpdating([caller], caller);
      const service = makeService({ ...repos, auditLogService });

      const result = await service.setMembersActivityVisibility(
        'org-1',
        'team-1',
        'user-admin-1',
        false,
      );

      expect(result).toEqual({ updated: 0 });
      expect(record).not.toHaveBeenCalled();
    });

    it('records what was applied, so a bulk hide is auditable', async () => {
      const caller = member('admin-1', { role: MembershipRole.ADMIN });
      const { auditLogService, record } = makeAuditLogService();
      const repos = makeUpdating([member('m-1'), caller], caller);
      const service = makeService({ ...repos, auditLogService });

      await service.setMembersActivityVisibility(
        'org-1',
        'team-1',
        'user-admin-1',
        false,
      );

      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'team.activity_visibility_set',
          metadata: { teamId: 'team-1', canViewOwnActivity: false, members: 1 },
        }),
      );
    });
  });

  describe('create', () => {
    it('creates a team and records an audit log entry', async () => {
      const teamsRepo = makeTeamsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const { dataSource } = makeDataSource();
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({ teamsRepo, dataSource, auditLogService });

      const team = await service.create('org-1', 'admin-1', {
        name: 'Engineering',
      });

      expect(team.name).toBe('Engineering');
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'team.created' }),
      );
    });

    it('rejects a duplicate team name within the same organisation', async () => {
      const teamsRepo = makeTeamsRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ id: 'team-1', name: 'Engineering' }),
      });
      const service = makeService({ teamsRepo });

      await expect(
        service.create('org-1', 'admin-1', { name: 'Engineering' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('update', () => {
    it('renames a team', async () => {
      const teamsRepo = makeTeamsRepo({
        findOne: jest
          .fn()
          .mockResolvedValueOnce({ id: 'team-1', name: 'Old Name' }) // findTeamOrFail
          .mockResolvedValueOnce(null), // assertNameAvailable
      });
      const { dataSource, update } = makeDataSource();
      const service = makeService({ teamsRepo, dataSource });

      const team = await service.update('org-1', 'team-1', 'admin-1', {
        name: 'New Name',
      });

      expect(team.name).toBe('New Name');
      expect(update).toHaveBeenCalledWith(Team, 'team-1', { name: 'New Name' });
    });

    it('refuses a team manager removing an admin from their own team', async () => {
      const teamsRepo = makeTeamsRepo({
        findOne: jest.fn().mockResolvedValue({ id: 'team-1', name: 'Sales' }),
      });
      const service = makeService({
        teamsRepo,
        membershipsRepo: makeMembershipsRepo({
          findOne: jest
            .fn()
            .mockResolvedValueOnce({
              id: 'manager-membership',
              role: MembershipRole.MEMBER,
              teamMemberships: [{ teamId: 'team-1', isManager: true }],
            })
            .mockResolvedValueOnce({
              id: 'admin-membership',
              role: MembershipRole.ADMIN,
            }),
        }),
      });

      await expect(
        service.removeMember('org-1', 'team-1', 'admin-membership', 'mgr-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws when the team does not belong to the organisation', async () => {
      const teamsRepo = makeTeamsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const service = makeService({ teamsRepo });

      await expect(
        service.update('org-1', 'team-1', 'admin-1', { name: 'New Name' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects renaming to a name already used by another team', async () => {
      const teamsRepo = makeTeamsRepo({
        findOne: jest
          .fn()
          .mockResolvedValueOnce({ id: 'team-1', name: 'Old Name' })
          .mockResolvedValueOnce({ id: 'team-2', name: 'Sales' }),
      });
      const service = makeService({ teamsRepo });

      await expect(
        service.update('org-1', 'team-1', 'admin-1', { name: 'Sales' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('remove', () => {
    it('deletes a team and records an audit log entry', async () => {
      const teamsRepo = makeTeamsRepo({
        findOne: jest.fn().mockResolvedValue({ id: 'team-1', name: 'Sales' }),
        count: jest.fn().mockResolvedValue(1),
      });
      const { dataSource, delete: del } = makeDataSource();
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({ teamsRepo, dataSource, auditLogService });

      await service.remove('org-1', 'team-1', 'admin-1');

      expect(del).toHaveBeenCalledWith(Team, 'team-1');
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'team.deleted' }),
      );
    });

    it("blocks deleting the organisation's last remaining team", async () => {
      const teamsRepo = makeTeamsRepo({
        findOne: jest.fn().mockResolvedValue({ id: 'team-1', name: 'General' }),
        count: jest.fn().mockResolvedValue(0),
      });
      const service = makeService({ teamsRepo });

      await expect(
        service.remove('org-1', 'team-1', 'admin-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws when the team does not belong to the organisation', async () => {
      const teamsRepo = makeTeamsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const service = makeService({ teamsRepo });

      await expect(
        service.remove('org-1', 'team-1', 'admin-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getDetail', () => {
    it('shapes the team and its members, including isManager', async () => {
      const teamsRepo = makeTeamsRepo({
        findOne: jest.fn().mockResolvedValue({
          id: 'team-1',
          name: 'Engineering',
          teamMemberships: [
            {
              membershipId: 'membership-1',
              isManager: true,
              membership: {
                userId: 'user-1',
                user: { name: 'A B', email: 'a@b.test' },
              },
            },
          ],
        }),
      });
      const service = makeService({ teamsRepo });

      const detail = await service.getDetail('org-1', 'team-1');

      expect(detail).toEqual({
        id: 'team-1',
        name: 'Engineering',
        members: [
          {
            membershipId: 'membership-1',
            userId: 'user-1',
            name: 'A B',
            email: 'a@b.test',
            isManager: true,
            canViewOwnActivity: null,
          },
        ],
      });
    });

    it('throws when the team does not belong to the organisation', async () => {
      const teamsRepo = makeTeamsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const service = makeService({ teamsRepo });

      await expect(service.getDetail('org-1', 'team-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('addOrUpdateMember', () => {
    it("refuses a team manager changing an admin's role on their team", async () => {
      const teamsRepo = makeTeamsRepo({
        findOne: jest.fn().mockResolvedValue({ id: 'team-1', name: 'Sales' }),
      });
      const service = makeService({
        teamsRepo,
        membershipsRepo: makeMembershipsRepo({
          findOne: jest
            .fn()
            // The target is looked up first (it must exist), then the caller.
            .mockResolvedValueOnce({
              id: 'admin-membership',
              organisationId: 'org-1',
              status: MembershipStatus.ACTIVE,
              role: MembershipRole.ADMIN,
            })
            .mockResolvedValueOnce({
              id: 'manager-membership',
              role: MembershipRole.MEMBER,
              teamMemberships: [{ teamId: 'team-1', isManager: true }],
            })
            .mockResolvedValueOnce({
              id: 'admin-membership',
              role: MembershipRole.ADMIN,
            }),
        }),
      });

      await expect(
        service.addOrUpdateMember('org-1', 'team-1', 'mgr-1', {
          membershipId: 'admin-membership',
          isManager: true,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('adds a new member to the team', async () => {
      const teamsRepo = makeTeamsRepo({
        findOne: jest.fn().mockResolvedValue({ id: 'team-1', name: 'Sales' }),
      });
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue({
          id: 'membership-1',
          organisationId: 'org-1',
          status: MembershipStatus.ACTIVE,
          // Acting as 'admin-1': the caller lookup and the target lookup
          // share this mock, and an admin may act on anyone.
          role: MembershipRole.ADMIN,
        }),
      });
      const teamMembershipsRepo = makeTeamMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const { dataSource, create, save } = makeDataSource();
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        teamsRepo,
        membershipsRepo,
        teamMembershipsRepo,
        dataSource,
        auditLogService,
      });

      await service.addOrUpdateMember('org-1', 'team-1', 'admin-1', {
        membershipId: 'membership-1',
        isManager: true,
      });

      expect(create).toHaveBeenCalledWith(
        TeamMembership,
        expect.objectContaining({
          teamId: 'team-1',
          membershipId: 'membership-1',
          isManager: true,
        }),
      );
      expect(save).toHaveBeenCalled();
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'team.member_added' }),
      );
    });

    it('promotes an existing member to manager in place instead of duplicating the row', async () => {
      const teamsRepo = makeTeamsRepo({
        findOne: jest.fn().mockResolvedValue({ id: 'team-1', name: 'Sales' }),
      });
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue({
          id: 'membership-1',
          organisationId: 'org-1',
          status: MembershipStatus.ACTIVE,
          // Acting as 'admin-1': the caller lookup and the target lookup
          // share this mock, and an admin may act on anyone.
          role: MembershipRole.ADMIN,
        }),
      });
      const teamMembershipsRepo = makeTeamMembershipsRepo({
        findOne: jest.fn().mockResolvedValue({
          id: 'tm-1',
          teamId: 'team-1',
          membershipId: 'membership-1',
          isManager: false,
        }),
      });
      const { dataSource, update, create } = makeDataSource();
      const service = makeService({
        teamsRepo,
        membershipsRepo,
        teamMembershipsRepo,
        dataSource,
      });

      await service.addOrUpdateMember('org-1', 'team-1', 'admin-1', {
        membershipId: 'membership-1',
        isManager: true,
      });

      expect(update).toHaveBeenCalledWith(TeamMembership, 'tm-1', {
        isManager: true,
      });
      expect(create).not.toHaveBeenCalledWith(
        TeamMembership,
        expect.anything(),
      );
    });

    it('throws when the membership is not an active member of the organisation', async () => {
      const teamsRepo = makeTeamsRepo({
        findOne: jest.fn().mockResolvedValue({ id: 'team-1', name: 'Sales' }),
      });
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const service = makeService({ teamsRepo, membershipsRepo });

      await expect(
        service.addOrUpdateMember('org-1', 'team-1', 'admin-1', {
          membershipId: 'membership-1',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when the team does not belong to the organisation', async () => {
      const teamsRepo = makeTeamsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const service = makeService({ teamsRepo });

      await expect(
        service.addOrUpdateMember('org-1', 'team-1', 'admin-1', {
          membershipId: 'membership-1',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('removeMember', () => {
    it('removes the member and records an audit log entry', async () => {
      const teamsRepo = makeTeamsRepo({
        findOne: jest.fn().mockResolvedValue({ id: 'team-1', name: 'Sales' }),
      });
      const { dataSource, delete: del } = makeDataSource();
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        teamsRepo,
        dataSource,
        auditLogService,
        membershipsRepo: makeMembershipsRepo({
          findOne: jest.fn().mockResolvedValue({
            id: 'membership-1',
            role: MembershipRole.ADMIN,
          }),
        }),
      });

      await service.removeMember('org-1', 'team-1', 'membership-1', 'admin-1');

      expect(del).toHaveBeenCalledWith(TeamMembership, {
        teamId: 'team-1',
        membershipId: 'membership-1',
      });
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'team.member_removed' }),
      );
    });

    it('throws when the team does not belong to the organisation', async () => {
      const teamsRepo = makeTeamsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const service = makeService({ teamsRepo });

      await expect(
        service.removeMember('org-1', 'team-1', 'membership-1', 'admin-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
