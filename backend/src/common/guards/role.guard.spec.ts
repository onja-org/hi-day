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

  function makeReflector(requiredRoles: MembershipRole[] | undefined) {
    return {
      getAllAndOverride: jest.fn().mockReturnValue(requiredRoles),
    } as unknown as Reflector;
  }

  function makeMembershipsRepo(
    overrides: Partial<Repository<Membership>> = {},
  ) {
    return {
      findOne: jest.fn(),
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

  it('allows the request through when no role is required', async () => {
    const guard = new RoleGuard(
      makeReflector(undefined),
      makeMembershipsRepo(),
      makeOrganisationsRepo(),
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000')),
    ).resolves.toBe(true);
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
    });
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
});
