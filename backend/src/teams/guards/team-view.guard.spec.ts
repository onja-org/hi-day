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
import { TeamViewGuard } from './team-view.guard';

describe('TeamViewGuard', () => {
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
    const guard = new TeamViewGuard(
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
    const guard = new TeamViewGuard(
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
    const guard = new TeamViewGuard(
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

  it('allows a plain org member who is a plain team member to view it', async () => {
    const guard = new TeamViewGuard(
      makeMembershipsRepo(
        jest.fn().mockResolvedValue({ id: 'm-1', role: MembershipRole.MEMBER }),
      ).repo,
      makeOrganisationsRepo().repo,
      makeTeamMembershipsRepo(jest.fn().mockResolvedValue({ isManager: false }))
        .repo,
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000', 'team-1')),
    ).resolves.toBe(true);
  });

  it('allows a plain org member who manages the team to view it', async () => {
    const guard = new TeamViewGuard(
      makeMembershipsRepo(
        jest.fn().mockResolvedValue({ id: 'm-1', role: MembershipRole.MEMBER }),
      ).repo,
      makeOrganisationsRepo().repo,
      makeTeamMembershipsRepo(jest.fn().mockResolvedValue({ isManager: true }))
        .repo,
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000', 'team-1')),
    ).resolves.toBe(true);
  });

  it('rejects an org member who is not assigned to the team at all', async () => {
    const guard = new TeamViewGuard(
      makeMembershipsRepo(
        jest.fn().mockResolvedValue({ id: 'm-1', role: MembershipRole.MEMBER }),
      ).repo,
      makeOrganisationsRepo().repo,
      makeTeamMembershipsRepo(jest.fn().mockResolvedValue(null)).repo,
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000', 'team-1')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
