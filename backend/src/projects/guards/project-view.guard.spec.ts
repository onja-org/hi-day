import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { Organisation } from '../../database/entities/organisation.entity';
import { ProjectMembership } from '../../database/entities/project-membership.entity';
import { ProjectMembershipRole } from '../../database/entities/project-membership-role.enum';
import { ProjectTeam } from '../../database/entities/project-team.entity';
import { ProjectViewGuard } from './project-view.guard';

describe('ProjectViewGuard', () => {
  function makeContext(userId: string, publicId: string, projectId?: string) {
    const request: {
      userId: string;
      params: { id: string; projectId?: string };
      organisationId?: string;
    } = { userId, params: { id: publicId, projectId } };
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

  it('rejects a non-numeric organisation id without querying the database', async () => {
    const { repo: membershipsRepo, findOne: membershipsFindOne } =
      makeMembershipsRepo();
    const guard = new ProjectViewGuard(
      membershipsRepo,
      makeOrganisationsRepo().repo,
      makeProjectMembershipsRepo().repo,
      makeProjectTeamsRepo().repo,
    );

    await expect(
      guard.canActivate(makeContext('user-1', 'not-a-number')),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(membershipsFindOne).not.toHaveBeenCalled();
  });

  it('rejects when the caller has no active membership in the organisation', async () => {
    const guard = new ProjectViewGuard(
      makeMembershipsRepo(jest.fn().mockResolvedValue(null)).repo,
      makeOrganisationsRepo().repo,
      makeProjectMembershipsRepo().repo,
      makeProjectTeamsRepo().repo,
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000', 'project-1')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows an org admin through without checking project membership', async () => {
    const { repo: projectMembershipsRepo, findOne: projectMembershipsFindOne } =
      makeProjectMembershipsRepo();
    const guard = new ProjectViewGuard(
      makeMembershipsRepo(
        jest.fn().mockResolvedValue({ id: 'm-1', role: MembershipRole.ADMIN }),
      ).repo,
      makeOrganisationsRepo().repo,
      projectMembershipsRepo,
      makeProjectTeamsRepo().repo,
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000', 'project-1')),
    ).resolves.toBe(true);
    expect(projectMembershipsFindOne).not.toHaveBeenCalled();
  });

  it('allows an org manager through without checking project membership', async () => {
    const guard = new ProjectViewGuard(
      makeMembershipsRepo(
        jest
          .fn()
          .mockResolvedValue({ id: 'm-1', role: MembershipRole.MANAGER }),
      ).repo,
      makeOrganisationsRepo().repo,
      makeProjectMembershipsRepo().repo,
      makeProjectTeamsRepo().repo,
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000', 'project-1')),
    ).resolves.toBe(true);
  });

  it('allows a plain org member who is a plain project member to view it', async () => {
    const guard = new ProjectViewGuard(
      makeMembershipsRepo(
        jest.fn().mockResolvedValue({ id: 'm-1', role: MembershipRole.MEMBER }),
      ).repo,
      makeOrganisationsRepo().repo,
      makeProjectMembershipsRepo(
        jest.fn().mockResolvedValue({ role: ProjectMembershipRole.MEMBER }),
      ).repo,
      makeProjectTeamsRepo().repo,
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000', 'project-1')),
    ).resolves.toBe(true);
  });

  it('allows a plain org member who is a project manager to view it', async () => {
    const guard = new ProjectViewGuard(
      makeMembershipsRepo(
        jest.fn().mockResolvedValue({ id: 'm-1', role: MembershipRole.MEMBER }),
      ).repo,
      makeOrganisationsRepo().repo,
      makeProjectMembershipsRepo(
        jest.fn().mockResolvedValue({ role: ProjectMembershipRole.MANAGER }),
      ).repo,
      makeProjectTeamsRepo().repo,
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000', 'project-1')),
    ).resolves.toBe(true);
  });

  it('rejects an org member who is not assigned to the project at all', async () => {
    const guard = new ProjectViewGuard(
      makeMembershipsRepo(
        jest.fn().mockResolvedValue({ id: 'm-1', role: MembershipRole.MEMBER }),
      ).repo,
      makeOrganisationsRepo().repo,
      makeProjectMembershipsRepo(jest.fn().mockResolvedValue(null)).repo,
      makeProjectTeamsRepo().repo,
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000', 'project-1')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows an org member with no direct ProjectMembership who reaches the project via a Team', async () => {
    const guard = new ProjectViewGuard(
      makeMembershipsRepo(
        jest.fn().mockResolvedValue({ id: 'm-1', role: MembershipRole.MEMBER }),
      ).repo,
      makeOrganisationsRepo().repo,
      makeProjectMembershipsRepo(jest.fn().mockResolvedValue(null)).repo,
      makeProjectTeamsRepo(jest.fn().mockResolvedValue({ id: 'pt-1' })).repo,
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000', 'project-1')),
    ).resolves.toBe(true);
  });
});
