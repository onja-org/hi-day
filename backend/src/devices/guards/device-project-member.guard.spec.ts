import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { ProjectMembership } from '../../database/entities/project-membership.entity';
import { ProjectTeam } from '../../database/entities/project-team.entity';
import { DeviceProjectMemberGuard } from './device-project-member.guard';

describe('DeviceProjectMemberGuard', () => {
  function makeContext(
    userId: string,
    organisationId: string,
    projectId?: string,
  ) {
    const request = {
      userId,
      organisationId,
      params: { projectId },
    };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  function makeMembershipsRepo(findOne = jest.fn()) {
    return { repo: { findOne } as unknown as Repository<Membership>, findOne };
  }

  function makeProjectMembershipsRepo(findOne = jest.fn()) {
    return {
      repo: { findOne } as unknown as Repository<ProjectMembership>,
      findOne,
    };
  }

  function makeProjectTeamsRepo(getOne = jest.fn().mockResolvedValue(null)) {
    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne,
    };
    return {
      repo: {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      } as unknown as Repository<ProjectTeam>,
      getOne,
    };
  }

  it('rejects when the caller has no active membership in the organisation', async () => {
    const guard = new DeviceProjectMemberGuard(
      makeMembershipsRepo(jest.fn().mockResolvedValue(null)).repo,
      makeProjectMembershipsRepo().repo,
      makeProjectTeamsRepo().repo,
    );

    await expect(
      guard.canActivate(makeContext('user-1', 'org-1', 'project-1')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows an org admin through without checking project membership', async () => {
    const { repo: projectMembershipsRepo, findOne: projectMembershipsFindOne } =
      makeProjectMembershipsRepo();
    const guard = new DeviceProjectMemberGuard(
      makeMembershipsRepo(
        jest.fn().mockResolvedValue({ id: 'm-1', role: MembershipRole.ADMIN }),
      ).repo,
      projectMembershipsRepo,
      makeProjectTeamsRepo().repo,
    );

    await expect(
      guard.canActivate(makeContext('user-1', 'org-1', 'project-1')),
    ).resolves.toBe(true);
    expect(projectMembershipsFindOne).not.toHaveBeenCalled();
  });

  it('allows an org member who is a project member on this project', async () => {
    const guard = new DeviceProjectMemberGuard(
      makeMembershipsRepo(
        jest.fn().mockResolvedValue({ id: 'm-1', role: MembershipRole.MEMBER }),
      ).repo,
      makeProjectMembershipsRepo(jest.fn().mockResolvedValue({ id: 'pm-1' }))
        .repo,
      makeProjectTeamsRepo().repo,
    );

    await expect(
      guard.canActivate(makeContext('user-1', 'org-1', 'project-1')),
    ).resolves.toBe(true);
  });

  it('allows an org member with no direct ProjectMembership who reaches the project via a Team', async () => {
    const guard = new DeviceProjectMemberGuard(
      makeMembershipsRepo(
        jest.fn().mockResolvedValue({ id: 'm-1', role: MembershipRole.MEMBER }),
      ).repo,
      makeProjectMembershipsRepo(jest.fn().mockResolvedValue(null)).repo,
      makeProjectTeamsRepo(jest.fn().mockResolvedValue({ id: 'pt-1' })).repo,
    );

    await expect(
      guard.canActivate(makeContext('user-1', 'org-1', 'project-1')),
    ).resolves.toBe(true);
  });

  it('rejects an org member who is not assigned to the project at all', async () => {
    const guard = new DeviceProjectMemberGuard(
      makeMembershipsRepo(
        jest.fn().mockResolvedValue({ id: 'm-1', role: MembershipRole.MEMBER }),
      ).repo,
      makeProjectMembershipsRepo(jest.fn().mockResolvedValue(null)).repo,
      makeProjectTeamsRepo().repo,
    );

    await expect(
      guard.canActivate(makeContext('user-1', 'org-1', 'project-1')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
