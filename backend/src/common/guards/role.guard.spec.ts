import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Repository } from 'typeorm';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { Organisation } from '../../database/entities/organisation.entity';
import { ALLOW_SUSPENDED_ORGANISATION_KEY } from '../decorators/allow-suspended-organisation.decorator';
import { ALLOW_TEAM_MANAGERS_KEY } from '../decorators/allow-team-managers.decorator';
import { RoleGuard } from './role.guard';

describe('RoleGuard', () => {
  function makeContext(userId: string, publicId: string) {
    const request: {
      userId: string;
      params: { id: string };
      organisationId?: string;
    } = { userId, params: { id: publicId } };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
      request,
    } as unknown as ExecutionContext & { request: typeof request };
  }

  function makeReflector(
    requiredRoles: MembershipRole[] | undefined,
    allowTeamManagers = false,
    allowSuspended = false,
  ) {
    return {
      getAllAndOverride: jest.fn((key: string) => {
        if (key === ALLOW_TEAM_MANAGERS_KEY) return allowTeamManagers;
        if (key === ALLOW_SUSPENDED_ORGANISATION_KEY) return allowSuspended;
        return requiredRoles;
      }),
    } as unknown as Reflector;
  }

  const teamManager = {
    role: MembershipRole.MEMBER,
    teamMemberships: [{ teamId: 'team-1', isManager: true }],
  };

  function makeMembershipsRepo(
    overrides: Partial<Repository<Membership>> = {},
  ) {
    return {
      findOne: jest.fn().mockResolvedValue({ role: MembershipRole.MEMBER }),
      ...overrides,
    } as unknown as Repository<Membership>;
  }

  function makeOrganisationsRepo(
    overrides: Partial<Repository<Organisation>> = {},
  ) {
    return {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'org-uuid-1', publicId: 100000 }),
      ...overrides,
    } as unknown as Repository<Organisation>;
  }

  it('resolves the public id to the organisation UUID and stashes it on the request', async () => {
    const findOne = jest
      .fn()
      .mockResolvedValue({ id: 'org-uuid-1', publicId: 100000 });
    const guard = new RoleGuard(
      makeReflector(undefined),
      makeMembershipsRepo(),
      makeOrganisationsRepo({ findOne }),
    );
    const context = makeContext('user-1', '100000');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(findOne).toHaveBeenCalledWith({
      where: { publicId: 100000 },
    });
    expect(context.request.organisationId).toBe('org-uuid-1');
  });

  it('rejects a non-numeric id without querying the database', async () => {
    const findOne = jest
      .fn()
      .mockResolvedValue({ id: 'org-uuid-1', publicId: 100000 });
    const guard = new RoleGuard(
      makeReflector(undefined),
      makeMembershipsRepo(),
      makeOrganisationsRepo({ findOne }),
    );

    await expect(
      guard.canActivate(makeContext('user-1', 'not-a-number')),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(findOne).not.toHaveBeenCalled();
  });

  it('rejects when no organisation has that public id', async () => {
    const organisationsRepo = makeOrganisationsRepo({
      findOne: jest.fn().mockResolvedValue(null),
    });
    const guard = new RoleGuard(
      makeReflector(undefined),
      makeMembershipsRepo(),
      organisationsRepo,
    );

    await expect(
      guard.canActivate(makeContext('user-1', '999999')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows the request through when no role is required, as long as the caller has an active membership', async () => {
    const findOne = jest
      .fn()
      .mockResolvedValue({ role: MembershipRole.MEMBER });
    const guard = new RoleGuard(
      makeReflector(undefined),
      makeMembershipsRepo({ findOne }),
      makeOrganisationsRepo(),
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000')),
    ).resolves.toBe(true);
  });

  it('rejects when no role is required but the caller has no active membership in that organisation', async () => {
    const findOne = jest.fn().mockResolvedValue(null);
    const guard = new RoleGuard(
      makeReflector(undefined),
      makeMembershipsRepo({ findOne }),
      makeOrganisationsRepo(),
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows the request when the caller's membership has one of the required roles", async () => {
    const findOne = jest.fn().mockResolvedValue({ role: MembershipRole.ADMIN });
    const guard = new RoleGuard(
      makeReflector([MembershipRole.ADMIN]),
      makeMembershipsRepo({ findOne }),
      makeOrganisationsRepo(),
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000')),
    ).resolves.toBe(true);
    expect(findOne).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        organisationId: 'org-uuid-1',
        status: MembershipStatus.ACTIVE,
      },
      relations: { teamMemberships: true },
    });
  });

  const suspendedOrganisation = {
    id: 'org-uuid-1',
    publicId: 100000,
    suspendedAt: new Date(),
  };

  it('rejects everyone, admins included, once the organisation is suspended', async () => {
    const membershipsFindOne = jest
      .fn()
      .mockResolvedValue({ role: MembershipRole.ADMIN });
    const guard = new RoleGuard(
      makeReflector([MembershipRole.ADMIN]),
      makeMembershipsRepo({ findOne: membershipsFindOne }),
      makeOrganisationsRepo({
        findOne: jest.fn().mockResolvedValue(suspendedOrganisation),
      }),
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000')),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(membershipsFindOne).not.toHaveBeenCalled();
  });

  it('lets a suspended organisation through a route marked @AllowSuspendedOrganisation', async () => {
    const guard = new RoleGuard(
      makeReflector([MembershipRole.ADMIN], false, true),
      makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue({ role: MembershipRole.ADMIN }),
      }),
      makeOrganisationsRepo({
        findOne: jest.fn().mockResolvedValue(suspendedOrganisation),
      }),
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000')),
    ).resolves.toBe(true);
  });

  it('rejects when the caller has no active membership in that organisation', async () => {
    const findOne = jest.fn().mockResolvedValue(null);
    const guard = new RoleGuard(
      makeReflector([MembershipRole.ADMIN]),
      makeMembershipsRepo({ findOne }),
      makeOrganisationsRepo(),
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects when the caller's role isn't one of the required roles", async () => {
    const findOne = jest
      .fn()
      .mockResolvedValue({ role: MembershipRole.MEMBER });
    const guard = new RoleGuard(
      makeReflector([MembershipRole.ADMIN]),
      makeMembershipsRepo({ findOne }),
      makeOrganisationsRepo(),
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets whoever manages a team through a manager route that opted in', async () => {
    const guard = new RoleGuard(
      makeReflector([MembershipRole.ADMIN, MembershipRole.MANAGER], true),
      makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(teamManager),
      }),
      makeOrganisationsRepo(),
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000')),
    ).resolves.toBe(true);
  });

  it('refuses a team manager a manager route that did not opt in', async () => {
    const guard = new RoleGuard(
      makeReflector([MembershipRole.ADMIN, MembershipRole.MANAGER]),
      makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(teamManager),
      }),
      makeOrganisationsRepo(),
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses the manager role with no team even where the route opted in', async () => {
    const guard = new RoleGuard(
      makeReflector([MembershipRole.ADMIN], true),
      makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue({
          role: MembershipRole.MANAGER,
          teamMemberships: [],
        }),
      }),
      makeOrganisationsRepo(),
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
