import { NotFoundException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { AuditLogService } from '../../../audit-log/services/audit-log.service';
import { Membership } from '../../../database/entities/membership.entity';
import { MembershipRole } from '../../../database/entities/membership-role.enum';
import { Organisation } from '../../../database/entities/organisation.entity';
import { OrganisationRegion } from '../../../database/entities/organisation-region.enum';
import { Team } from '../../../database/entities/team.entity';
import { OrganisationsService } from '../organisations.service';

describe('OrganisationsService', () => {
  function makeManager() {
    const create = jest.fn(
      (_entity: unknown, data: Record<string, unknown>) => data,
    );
    let orgCounter = 0;
    let teamCounter = 0;
    const save = jest.fn((entity: Record<string, unknown>) => {
      if ('slug' in entity) {
        return Promise.resolve({ id: `org-${++orgCounter}`, ...entity });
      }
      if ('organisationId' in entity && !('userId' in entity)) {
        return Promise.resolve({ id: `team-${++teamCounter}`, ...entity });
      }
      return Promise.resolve({ id: 'membership-1', ...entity });
    });
    const manager = { create, save } as unknown as EntityManager;
    return { manager, create, save };
  }

  function makeOrganisationsRepo(
    overrides: Partial<Repository<Organisation>> = {},
  ) {
    return {
      findOneOrFail: jest.fn(),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      ...overrides,
    } as unknown as Repository<Organisation>;
  }

  function makeMembershipsRepo(
    overrides: Partial<Repository<Membership>> = {},
  ) {
    return {
      findOne: jest.fn(),
      ...overrides,
    } as unknown as Repository<Membership>;
  }

  function makeTeamsRepo(overrides: Partial<Repository<Team>> = {}) {
    return {
      find: jest.fn().mockResolvedValue([]),
      ...overrides,
    } as unknown as Repository<Team>;
  }

  function makeAuditLogService() {
    const record = jest.fn().mockResolvedValue(undefined);
    return {
      auditLogService: { record } as unknown as AuditLogService,
      record,
    };
  }

  describe('createForUser', () => {
    it('creates the organisation, a default "General" team, and an admin membership linked to it', async () => {
      const { manager, create } = makeManager();
      const { auditLogService, record } = makeAuditLogService();
      const service = new OrganisationsService(
        makeOrganisationsRepo(),
        makeMembershipsRepo(),
        makeTeamsRepo(),
        auditLogService,
      );

      const organisation = await service.createForUser(manager, 'user-1', {
        name: 'Acme Inc',
        address: '1 Main St',
        website: 'https://acme.test',
      });

      expect(create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: 'Acme Inc',
          region: OrganisationRegion.US,
          settings: {
            timezone: 'UTC',
            currency: 'USD',
            address: '1 Main St',
            website: 'https://acme.test',
          },
        }),
      );
      expect(create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: 'General',
          organisationId: 'org-1',
        }),
      );
      expect(create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: 'user-1',
          organisationId: 'org-1',
          teamId: 'team-1',
          role: MembershipRole.ADMIN,
        }),
      );
      expect(record).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({
          action: 'organisation.created',
          organisationId: 'org-1',
          actorUserId: 'user-1',
        }),
      );
      expect(organisation.id).toBe('org-1');
    });

    it('defaults address and website to null when omitted', async () => {
      const { manager, create } = makeManager();
      const service = new OrganisationsService(
        makeOrganisationsRepo(),
        makeMembershipsRepo(),
        makeTeamsRepo(),
        makeAuditLogService().auditLogService,
      );

      await service.createForUser(manager, 'user-1', { name: 'Acme Inc' });

      expect(create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          settings: {
            timezone: 'UTC',
            currency: 'USD',
            address: null,
            website: null,
          },
        }),
      );
    });
  });

  describe('findCurrentForUser', () => {
    it("returns the organisation profile, including the caller's role, for the user's membership", async () => {
      const findOne = jest.fn().mockResolvedValue({
        role: MembershipRole.MANAGER,
        organisation: {
          id: 'org-1',
          publicId: 100000,
          name: 'Acme Inc',
          settings: { address: '1 Main St', website: 'https://acme.test' },
        },
      });
      const service = new OrganisationsService(
        makeOrganisationsRepo(),
        makeMembershipsRepo({ findOne }),
        makeTeamsRepo(),
        makeAuditLogService().auditLogService,
      );

      const profile = await service.findCurrentForUser('user-1');

      expect(profile).toEqual({
        id: 100000,
        name: 'Acme Inc',
        address: '1 Main St',
        website: 'https://acme.test',
        role: MembershipRole.MANAGER,
        idleHandling: 'flag',
        idleThresholdMinutes: 5,
      });
    });

    it('throws when the user has no membership', async () => {
      const findOne = jest.fn().mockResolvedValue(null);
      const service = new OrganisationsService(
        makeOrganisationsRepo(),
        makeMembershipsRepo({ findOne }),
        makeTeamsRepo(),
        makeAuditLogService().auditLogService,
      );

      await expect(service.findCurrentForUser('user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('listTeams', () => {
    it("returns the organisation's teams as id/name pairs, ordered by name", async () => {
      const find = jest.fn().mockResolvedValue([
        { id: 'team-2', name: 'Sales', organisationId: 'org-1' },
        { id: 'team-1', name: 'General', organisationId: 'org-1' },
      ]);
      const service = new OrganisationsService(
        makeOrganisationsRepo(),
        makeMembershipsRepo(),
        makeTeamsRepo({ find }),
        makeAuditLogService().auditLogService,
      );

      const teams = await service.listTeams('org-1');

      expect(find).toHaveBeenCalledWith({
        where: { organisationId: 'org-1' },
        order: { name: 'ASC' },
      });
      expect(teams).toEqual([
        { id: 'team-2', name: 'Sales' },
        { id: 'team-1', name: 'General' },
      ]);
    });
  });

  describe('updateProfile', () => {
    it('updates the name and settings fields (authorization is enforced by RoleGuard upstream)', async () => {
      const organisation = {
        id: 'org-1',
        publicId: 100000,
        name: 'Acme Inc',
        settings: { timezone: 'UTC', currency: 'USD', address: 'old' },
      } as unknown as Organisation;
      const findOneOrFail = jest.fn().mockResolvedValue(organisation);
      const save = jest.fn((entity: unknown) => Promise.resolve(entity));
      const service = new OrganisationsService(
        makeOrganisationsRepo({ findOneOrFail, save }),
        makeMembershipsRepo(),
        makeTeamsRepo(),
        makeAuditLogService().auditLogService,
      );

      const profile = await service.updateProfile('org-1', {
        name: 'Acme International',
        address: 'new address',
      });

      expect(profile.id).toBe(100000);
      expect(profile.name).toBe('Acme International');
      expect(profile.address).toBe('new address');
      expect(profile.role).toBe(MembershipRole.ADMIN);
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Acme International',
          settings: expect.objectContaining({
            address: 'new address',
          }) as unknown,
        }),
      );
    });

    it('updates the idle policy fields', async () => {
      const organisation = {
        id: 'org-1',
        publicId: 100000,
        name: 'Acme Inc',
        settings: {},
      } as unknown as Organisation;
      const service = new OrganisationsService(
        makeOrganisationsRepo({
          findOneOrFail: jest.fn().mockResolvedValue(organisation),
          save: jest.fn((entity: unknown) => Promise.resolve(entity)),
        }),
        makeMembershipsRepo(),
        makeTeamsRepo(),
        makeAuditLogService().auditLogService,
      );

      const profile = await service.updateProfile('org-1', {
        idleHandling: 'auto_subtract',
        idleThresholdMinutes: 10,
      });

      expect(profile.idleHandling).toBe('auto_subtract');
      expect(profile.idleThresholdMinutes).toBe(10);
    });
  });

  describe('getIdlePolicy', () => {
    it('returns the defaults when the organisation has no explicit idle settings', async () => {
      const service = new OrganisationsService(
        makeOrganisationsRepo({
          findOneOrFail: jest.fn().mockResolvedValue({
            id: 'org-1',
            settings: {},
          }),
        }),
        makeMembershipsRepo(),
        makeTeamsRepo(),
        makeAuditLogService().auditLogService,
      );

      await expect(service.getIdlePolicy('org-1')).resolves.toEqual({
        handling: 'flag',
        thresholdMinutes: 5,
      });
    });

    it('returns the organisation-configured policy when set', async () => {
      const service = new OrganisationsService(
        makeOrganisationsRepo({
          findOneOrFail: jest.fn().mockResolvedValue({
            id: 'org-1',
            settings: { idleHandling: 'off', idleThresholdMinutes: 15 },
          }),
        }),
        makeMembershipsRepo(),
        makeTeamsRepo(),
        makeAuditLogService().auditLogService,
      );

      await expect(service.getIdlePolicy('org-1')).resolves.toEqual({
        handling: 'off',
        thresholdMinutes: 15,
      });
    });
  });
});
