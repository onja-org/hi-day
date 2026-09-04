import { ConflictException, NotFoundException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { AuditLogService } from '../../../audit-log/services/audit-log.service';
import { Membership } from '../../../database/entities/membership.entity';
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
    it('adds a new member to the team', async () => {
      const teamsRepo = makeTeamsRepo({
        findOne: jest.fn().mockResolvedValue({ id: 'team-1', name: 'Sales' }),
      });
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue({
          id: 'membership-1',
          organisationId: 'org-1',
          status: MembershipStatus.ACTIVE,
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
      const service = makeService({ teamsRepo, dataSource, auditLogService });

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
