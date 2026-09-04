import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { Organisation } from '../../database/entities/organisation.entity';
import { TeamMembership } from '../../database/entities/team-membership.entity';
import { TeamRoleGuard } from './team-role.guard';

describe('TeamRoleGuard', () => {
  function makeContext(userId: string, publicId: string, teamId?: string) {
    const request: {
      userId: string;
      params: { id: string; teamId?: string };
      organisationId?: string;
    } = { userId, params: { id: publicId, teamId } };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      request,
    } as unknown as ExecutionContext & { request: typeof request };
  }

  function makeMembershipsRepo(findOne = jest.fn()) {
    return { repo: { findOne } as unknown as Repository<Membership>, findOne };
  }

  function makeOrganisationsRepo(
    findOne = jest
      .fn()
      .mockResolvedValue({ id: 'org-uuid-1', publicId: 100000 }),
  ) {
    return {
      repo: { findOne } as unknown as Repository<Organisation>,
      findOne,
    };
  }

  function makeTeamMembershipsRepo(findOne = jest.fn()) {
    return {
      repo: { findOne } as unknown as Repository<TeamMembership>,
      findOne,
    };
  }

  it('rejects a non-numeric organisation id without querying the database', async () => {
    const { repo: membershipsRepo, findOne: membershipsFindOne } =
      makeMembershipsRepo();
    const guard = new TeamRoleGuard(
      membershipsRepo,
      makeOrganisationsRepo().repo,
      makeTeamMembershipsRepo().repo,
    );

    await expect(
      guard.canActivate(makeContext('user-1', 'not-a-number')),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(membershipsFindOne).not.toHaveBeenCalled();
  });

  it('rejects when the caller has no active membership in the organisation', async () => {
    const guard = new TeamRoleGuard(
      makeMembershipsRepo(jest.fn().mockResolvedValue(null)).repo,
      makeOrganisationsRepo().repo,
      makeTeamMembershipsRepo().repo,
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000', 'team-1')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows an org admin through without checking team membership', async () => {
    const { repo: teamMembershipsRepo, findOne: teamMembershipsFindOne } =
      makeTeamMembershipsRepo();
    const guard = new TeamRoleGuard(
      makeMembershipsRepo(
        jest.fn().mockResolvedValue({ id: 'm-1', role: MembershipRole.ADMIN }),
      ).repo,
      makeOrganisationsRepo().repo,
      teamMembershipsRepo,
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000', 'team-1')),
    ).resolves.toBe(true);
    expect(teamMembershipsFindOne).not.toHaveBeenCalled();
  });

  it('allows a manager who manages this specific team', async () => {
    const { repo: teamMembershipsRepo, findOne: teamMembershipsFindOne } =
      makeTeamMembershipsRepo(jest.fn().mockResolvedValue({ isManager: true }));
    const guard = new TeamRoleGuard(
      makeMembershipsRepo(
        jest
          .fn()
          .mockResolvedValue({ id: 'm-1', role: MembershipRole.MANAGER }),
      ).repo,
      makeOrganisationsRepo().repo,
      teamMembershipsRepo,
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000', 'team-1')),
    ).resolves.toBe(true);
    expect(teamMembershipsFindOne).toHaveBeenCalledWith({
      where: { teamId: 'team-1', membershipId: 'm-1' },
    });
  });

  it('rejects an org manager who is on the team but not its manager', async () => {
    const guard = new TeamRoleGuard(
      makeMembershipsRepo(
        jest
          .fn()
          .mockResolvedValue({ id: 'm-1', role: MembershipRole.MANAGER }),
      ).repo,
      makeOrganisationsRepo().repo,
      makeTeamMembershipsRepo(jest.fn().mockResolvedValue({ isManager: false }))
        .repo,
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000', 'team-1')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a manager who manages a different team entirely', async () => {
    const guard = new TeamRoleGuard(
      makeMembershipsRepo(
        jest
          .fn()
          .mockResolvedValue({ id: 'm-1', role: MembershipRole.MANAGER }),
      ).repo,
      makeOrganisationsRepo().repo,
      makeTeamMembershipsRepo(jest.fn().mockResolvedValue(null)).repo,
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000', 'team-1')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a plain member', async () => {
    const guard = new TeamRoleGuard(
      makeMembershipsRepo(
        jest.fn().mockResolvedValue({ id: 'm-1', role: MembershipRole.MEMBER }),
      ).repo,
      makeOrganisationsRepo().repo,
      makeTeamMembershipsRepo(jest.fn().mockResolvedValue({ isManager: false }))
        .repo,
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000', 'team-1')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
