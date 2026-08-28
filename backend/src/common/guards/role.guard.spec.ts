import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Repository } from 'typeorm';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { RoleGuard } from './role.guard';

describe('RoleGuard', () => {
  function makeContext(userId: string, organisationId: string) {
    const request = { userId, params: { id: organisationId } };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
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

  it('allows the request through when no role is required', async () => {
    const guard = new RoleGuard(
      makeReflector(undefined),
      makeMembershipsRepo(),
    );

    await expect(
      guard.canActivate(makeContext('user-1', 'org-1')),
    ).resolves.toBe(true);
  });

  it("allows the request when the caller's membership has one of the required roles", async () => {
    const findOne = jest.fn().mockResolvedValue({ role: MembershipRole.ADMIN });
    const guard = new RoleGuard(
      makeReflector([MembershipRole.ADMIN]),
      makeMembershipsRepo({ findOne }),
    );

    await expect(
      guard.canActivate(makeContext('user-1', 'org-1')),
    ).resolves.toBe(true);
    expect(findOne).toHaveBeenCalledWith({
      where: { userId: 'user-1', organisationId: 'org-1' },
    });
  });

  it('rejects when the caller has no membership in that organisation', async () => {
    const findOne = jest.fn().mockResolvedValue(null);
    const guard = new RoleGuard(
      makeReflector([MembershipRole.ADMIN]),
      makeMembershipsRepo({ findOne }),
    );

    await expect(
      guard.canActivate(makeContext('user-1', 'org-1')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects when the caller's role isn't one of the required roles", async () => {
    const findOne = jest
      .fn()
      .mockResolvedValue({ role: MembershipRole.MEMBER });
    const guard = new RoleGuard(
      makeReflector([MembershipRole.ADMIN]),
      makeMembershipsRepo({ findOne }),
    );

    await expect(
      guard.canActivate(makeContext('user-1', 'org-1')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
