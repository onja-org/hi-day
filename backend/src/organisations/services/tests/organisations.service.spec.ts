import { TimeEntriesService } from '../../../time-entries/services/time-entries.service';
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

  function makeTimeEntriesService(): TimeEntriesService {
    return {
      stopEntriesDisallowedByApps: jest.fn().mockResolvedValue(0),
    } as unknown as TimeEntriesService;
  }

  function makeTeamsRepo(overrides: Partial<Repository<Team>> = {}) {
    return {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
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
    it('creates the organisation, a default "General" team, and an admin membership with no team_memberships row', async () => {
      const { manager, create } = makeManager();
      const { auditLogService, record } = makeAuditLogService();
      const service = new OrganisationsService(
        makeOrganisationsRepo(),
        makeMembershipsRepo(),
        makeTeamsRepo(),
        auditLogService,
        makeTimeEntriesService(),
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
          role: MembershipRole.ADMIN,
        }),
      );
      const membershipCreateCall = create.mock.calls.find(
        (call) => call[1].userId === 'user-1',
      );
      expect(membershipCreateCall?.[1]).not.toHaveProperty('teamId');
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
        makeTimeEntriesService(),
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
        makeTimeEntriesService(),
      );

      const profile = await service.findCurrentForUser('user-1');

      expect(profile).toEqual({
        id: 100000,
        name: 'Acme Inc',
        address: '1 Main St',
        industry: null,
        taxId: null,
        website: 'https://acme.test',
        role: MembershipRole.MANAGER,
        idleHandling: 'flag',
        idleThresholdMinutes: 5,
        windowTrackingEnabled: true,
        appUrlTracking: 'apps',
        allowedApps: 'all',
        timesheetModifyTime: 'off',
        canModifyTime: false,
        timesheetRequireApproval: false,
        timesheetManagersApproveOwn: false,
        timesheetRequireReason: true,
        screenshotsEnabled: false,
        screenshotFrequencySeconds: 600,
        screenshotRetentionDays: 30,
        workingHoursPerDay: 8,
        timezone: 'UTC',
        weekStartsOn: 'monday',
        userId: 'user-1',
        isOwner: false,
        deletionScheduledFor: null,
        suspendedAt: null,
        purgeAt: null,
      });
    });

    it('throws when the user has no membership', async () => {
      const findOne = jest.fn().mockResolvedValue(null);
      const service = new OrganisationsService(
        makeOrganisationsRepo(),
        makeMembershipsRepo({ findOne }),
        makeTeamsRepo(),
        makeAuditLogService().auditLogService,
        makeTimeEntriesService(),
      );

      await expect(service.findCurrentForUser('user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('prefers an organisation that is not suspended', async () => {
      const findOne = jest.fn().mockResolvedValue(null);
      const service = new OrganisationsService(
        makeOrganisationsRepo(),
        makeMembershipsRepo({ findOne }),
        makeTeamsRepo(),
        makeAuditLogService().auditLogService,
        makeTimeEntriesService(),
      );

      await service.findCurrentForUser('user-1').catch(() => undefined);

      expect(findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          order: {
            organisation: { suspendedAt: { direction: 'ASC', nulls: 'FIRST' } },
          },
        }),
      );
    });
  });

  describe('listTeams', () => {
    it('returns every organisation team for an admin caller', async () => {
      const findOne = jest.fn().mockResolvedValue({
        role: MembershipRole.ADMIN,
        teamMemberships: [],
      });
      const find = jest.fn().mockResolvedValue([
        { id: 'team-2', name: 'Sales', organisationId: 'org-1' },
        { id: 'team-1', name: 'General', organisationId: 'org-1' },
      ]);
      const service = new OrganisationsService(
        makeOrganisationsRepo(),
        makeMembershipsRepo({ findOne }),
        makeTeamsRepo({ find }),
        makeAuditLogService().auditLogService,
        makeTimeEntriesService(),
      );

      const teams = await service.listTeams('org-1', 'admin-1');

      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organisationId: 'org-1' },
          order: { name: 'ASC' },
        }),
      );
      expect(teams).toEqual([
        { id: 'team-2', name: 'Sales', members: [], projectCount: 0 },
        { id: 'team-1', name: 'General', members: [], projectCount: 0 },
      ]);
    });

    it("attaches each team's roster and assigned-project count", async () => {
      const findOne = jest.fn().mockResolvedValue({
        role: MembershipRole.ADMIN,
        teamMemberships: [],
      });
      const find = jest.fn().mockResolvedValue([
        {
          id: 'team-1',
          name: 'General',
          teamMemberships: [
            {
              membershipId: 'membership-1',
              isManager: true,
              membership: {
                userId: 'user-1',
                user: { name: 'Ada', email: 'ada@example.com' },
              },
            },
          ],
          projectTeams: [{ id: 'pt-1' }, { id: 'pt-2' }],
        },
      ]);
      const service = new OrganisationsService(
        makeOrganisationsRepo(),
        makeMembershipsRepo({ findOne }),
        makeTeamsRepo({ find }),
        makeAuditLogService().auditLogService,
        makeTimeEntriesService(),
      );

      const teams = await service.listTeams('org-1', 'admin-1');

      expect(teams).toEqual([
        {
          id: 'team-1',
          name: 'General',
          members: [
            {
              membershipId: 'membership-1',
              userId: 'user-1',
              name: 'Ada',
              email: 'ada@example.com',
              isManager: true,
            },
          ],
          projectCount: 2,
        },
      ]);
    });

    it('returns only the teams a manager caller belongs to', async () => {
      const findOne = jest.fn().mockResolvedValue({
        role: MembershipRole.MANAGER,
        teamMemberships: [{ teamId: 'team-1', isManager: true }],
      });
      const find = jest
        .fn()
        .mockResolvedValue([{ id: 'team-1', name: 'General' }]);
      const service = new OrganisationsService(
        makeOrganisationsRepo(),
        makeMembershipsRepo({ findOne }),
        makeTeamsRepo({ find }),
        makeAuditLogService().auditLogService,
        makeTimeEntriesService(),
      );

      const teams = await service.listTeams('org-1', 'manager-1');

      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organisationId: 'org-1',
          }) as unknown,
        }),
      );
      expect(teams).toEqual([
        { id: 'team-1', name: 'General', members: [], projectCount: 0 },
      ]);
    });

    it('returns an empty list for a teamless member caller', async () => {
      const findOne = jest.fn().mockResolvedValue({
        role: MembershipRole.MEMBER,
        teamMemberships: [],
      });
      const find = jest.fn();
      const service = new OrganisationsService(
        makeOrganisationsRepo(),
        makeMembershipsRepo({ findOne }),
        makeTeamsRepo({ find }),
        makeAuditLogService().auditLogService,
        makeTimeEntriesService(),
      );

      const teams = await service.listTeams('org-1', 'member-1');

      expect(find).not.toHaveBeenCalled();
      expect(teams).toEqual([]);
    });

    it('returns every team a member belongs to when they are on more than one', async () => {
      const findOne = jest.fn().mockResolvedValue({
        role: MembershipRole.MEMBER,
        teamMemberships: [
          { teamId: 'team-1', isManager: false },
          { teamId: 'team-2', isManager: false },
        ],
      });
      const find = jest.fn().mockResolvedValue([
        { id: 'team-1', name: 'General' },
        { id: 'team-2', name: 'Sales' },
      ]);
      const service = new OrganisationsService(
        makeOrganisationsRepo(),
        makeMembershipsRepo({ findOne }),
        makeTeamsRepo({ find }),
        makeAuditLogService().auditLogService,
        makeTimeEntriesService(),
      );

      const teams = await service.listTeams('org-1', 'member-1');

      expect(teams).toEqual([
        { id: 'team-1', name: 'General', members: [], projectCount: 0 },
        { id: 'team-2', name: 'Sales', members: [], projectCount: 0 },
      ]);
    });

    it('throws when the caller has no active membership in the organisation', async () => {
      const findOne = jest.fn().mockResolvedValue(null);
      const service = new OrganisationsService(
        makeOrganisationsRepo(),
        makeMembershipsRepo({ findOne }),
        makeTeamsRepo(),
        makeAuditLogService().auditLogService,
        makeTimeEntriesService(),
      );

      await expect(
        service.listTeams('org-1', 'caller-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
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
        makeTimeEntriesService(),
      );

      const profile = await service.updateProfile('org-1', 'user-1', {
        name: 'Acme International',
        address: 'new address',
      });

      expect(profile.id).toBe(100000);
      expect(profile.name).toBe('Acme International');
      expect(profile.address).toBe('new address');
      expect(profile.role).toBe(MembershipRole.ADMIN);
      expect(profile.userId).toBe('user-1');
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Acme International',
          settings: expect.objectContaining({
            address: 'new address',
          }) as unknown,
        }),
      );
    });

    it('stores the company-profile fields', async () => {
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
        makeTimeEntriesService(),
      );

      const profile = await service.updateProfile('org-1', 'user-1', {
        industry: 'software_it',
        taxId: '  GB123456789  ',
        weekStartsOn: 'sunday',
        timezone: 'Africa/Nairobi',
      });

      expect(profile.industry).toBe('software_it');
      expect(profile.taxId).toBe('GB123456789');
      expect(profile.weekStartsOn).toBe('sunday');
      expect(profile.timezone).toBe('Africa/Nairobi');
    });

    it('clears an optional profile field when sent an empty value', async () => {
      const organisation = {
        id: 'org-1',
        publicId: 100000,
        name: 'Acme Inc',
        settings: {
          industry: 'finance',
          taxId: 'GB123456789',
          address: '1 Main St',
          website: 'https://acme.test',
        },
      } as unknown as Organisation;
      const service = new OrganisationsService(
        makeOrganisationsRepo({
          findOneOrFail: jest.fn().mockResolvedValue(organisation),
          save: jest.fn((entity: unknown) => Promise.resolve(entity)),
        }),
        makeMembershipsRepo(),
        makeTeamsRepo(),
        makeAuditLogService().auditLogService,
        makeTimeEntriesService(),
      );

      const profile = await service.updateProfile('org-1', 'user-1', {
        industry: '',
        taxId: '',
        address: '   ',
        website: '',
      });

      expect(profile.industry).toBeNull();
      expect(profile.taxId).toBeNull();
      expect(profile.address).toBeNull();
      expect(profile.website).toBeNull();
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
        makeTimeEntriesService(),
      );

      const profile = await service.updateProfile('org-1', 'user-1', {
        idleHandling: 'auto_subtract',
        idleThresholdMinutes: 10,
      });

      expect(profile.idleHandling).toBe('auto_subtract');
      expect(profile.idleThresholdMinutes).toBe(10);
      expect(profile.userId).toBe('user-1');
    });

    it('updates the windowTrackingEnabled field', async () => {
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
        makeTimeEntriesService(),
      );

      const profile = await service.updateProfile('org-1', 'user-1', {
        windowTrackingEnabled: true,
      });

      expect(profile.windowTrackingEnabled).toBe(true);
    });

    it('updates the screenshot capture settings', async () => {
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
        makeTimeEntriesService(),
      );

      const profile = await service.updateProfile('org-1', 'user-1', {
        screenshotsEnabled: true,
        screenshotFrequencySeconds: 120,
        screenshotRetentionDays: 7,
      });

      expect(profile.screenshotsEnabled).toBe(true);
      expect(profile.screenshotFrequencySeconds).toBe(120);
      expect(profile.screenshotRetentionDays).toBe(7);
    });

    it('updates the workingHoursPerDay field', async () => {
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
        makeTimeEntriesService(),
      );

      const profile = await service.updateProfile('org-1', 'user-1', {
        workingHoursPerDay: 6,
      });

      expect(profile.workingHoursPerDay).toBe(6);
    });
  });

  describe('getWorkingHoursPolicy', () => {
    it('returns the default of 8 hours when the organisation has no explicit setting', async () => {
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
        makeTimeEntriesService(),
      );

      await expect(service.getWorkingHoursPolicy('org-1')).resolves.toEqual({
        hoursPerDay: 8,
      });
    });

    it('returns the organisation-configured value when set', async () => {
      const service = new OrganisationsService(
        makeOrganisationsRepo({
          findOneOrFail: jest.fn().mockResolvedValue({
            id: 'org-1',
            settings: { workingHoursPerDay: 6 },
          }),
        }),
        makeMembershipsRepo(),
        makeTeamsRepo(),
        makeAuditLogService().auditLogService,
        makeTimeEntriesService(),
      );

      await expect(service.getWorkingHoursPolicy('org-1')).resolves.toEqual({
        hoursPerDay: 6,
      });
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
        makeTimeEntriesService(),
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
        makeTimeEntriesService(),
      );

      await expect(service.getIdlePolicy('org-1')).resolves.toEqual({
        handling: 'off',
        thresholdMinutes: 15,
      });
    });
  });

  describe('getCaptureSettings', () => {
    it('defaults window tracking on, and everything else off, when the organisation has no explicit capture settings', async () => {
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
        makeTimeEntriesService(),
      );

      await expect(service.getCaptureSettings('org-1')).resolves.toEqual({
        windowTrackingEnabled: true,
        appUrlTracking: 'apps',
        allowedApps: 'all',
        screenshotsEnabled: false,
        screenshotFrequencySeconds: 600,
        screenshotRetentionDays: 30,
      });
    });

    it('returns the organisation-configured value when set', async () => {
      const service = new OrganisationsService(
        makeOrganisationsRepo({
          findOneOrFail: jest.fn().mockResolvedValue({
            id: 'org-1',
            settings: {
              windowTrackingEnabled: true,
              screenshotsEnabled: true,
              screenshotFrequencySeconds: 120,
              screenshotRetentionDays: 7,
            },
          }),
        }),
        makeMembershipsRepo(),
        makeTeamsRepo(),
        makeAuditLogService().auditLogService,
        makeTimeEntriesService(),
      );

      await expect(service.getCaptureSettings('org-1')).resolves.toEqual({
        windowTrackingEnabled: true,
        appUrlTracking: 'apps',
        allowedApps: 'all',
        screenshotsEnabled: true,
        screenshotFrequencySeconds: 120,
        screenshotRetentionDays: 7,
      });
    });

    it('sends allowedApps to the agent, with the member override applied', async () => {
      const service = new OrganisationsService(
        makeOrganisationsRepo({
          findOneOrFail: jest.fn().mockResolvedValue({
            id: 'org-1',
            settings: { allowedApps: 'desktop_only' },
          }),
        }),
        makeMembershipsRepo({
          findOne: jest.fn().mockResolvedValue({ allowedApps: 'mobile_only' }),
        }),
        makeTeamsRepo(),
        makeAuditLogService().auditLogService,
        makeTimeEntriesService(),
      );

      await expect(
        service.getCaptureSettings('org-1', 'user-1'),
      ).resolves.toMatchObject({ allowedApps: 'mobile_only' });
    });

    it("applies the member's own appUrlTracking override over the organisation default", async () => {
      const service = new OrganisationsService(
        makeOrganisationsRepo({
          findOneOrFail: jest.fn().mockResolvedValue({
            id: 'org-1',
            settings: { appUrlTracking: 'apps_urls' },
          }),
        }),
        makeMembershipsRepo({
          findOne: jest.fn().mockResolvedValue({ appUrlTracking: 'off' }),
        }),
        makeTeamsRepo(),
        makeAuditLogService().auditLogService,
        makeTimeEntriesService(),
      );

      await expect(
        service.getCaptureSettings('org-1', 'user-1'),
      ).resolves.toMatchObject({ appUrlTracking: 'off' });
    });
  });
});
