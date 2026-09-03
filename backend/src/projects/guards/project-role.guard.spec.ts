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
import { ProjectRoleGuard } from './project-role.guard';

describe('ProjectRoleGuard', () => {
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

  it('rejects a non-numeric organisation id without querying the database', async () => {
    const { repo: membershipsRepo, findOne: membershipsFindOne } =
      makeMembershipsRepo();
    const guard = new ProjectRoleGuard(
      membershipsRepo,
      makeOrganisationsRepo().repo,
      makeProjectMembershipsRepo().repo,
    );

    await expect(
      guard.canActivate(makeContext('user-1', 'not-a-number')),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(membershipsFindOne).not.toHaveBeenCalled();
  });

  it('rejects when the caller has no active membership in the organisation', async () => {
    const guard = new ProjectRoleGuard(
      makeMembershipsRepo(jest.fn().mockResolvedValue(null)).repo,
      makeOrganisationsRepo().repo,
      makeProjectMembershipsRepo().repo,
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000', 'project-1')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows an org admin through without checking project membership', async () => {
    const { repo: projectMembershipsRepo, findOne: projectMembershipsFindOne } =
      makeProjectMembershipsRepo();
    const guard = new ProjectRoleGuard(
      makeMembershipsRepo(
        jest.fn().mockResolvedValue({ id: 'm-1', role: MembershipRole.ADMIN }),
      ).repo,
      makeOrganisationsRepo().repo,
      projectMembershipsRepo,
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000', 'project-1')),
    ).resolves.toBe(true);
    expect(projectMembershipsFindOne).not.toHaveBeenCalled();
  });

  it('allows an org manager through without checking project membership', async () => {
    const guard = new ProjectRoleGuard(
      makeMembershipsRepo(
        jest
          .fn()
          .mockResolvedValue({ id: 'm-1', role: MembershipRole.MANAGER }),
      ).repo,
      makeOrganisationsRepo().repo,
      makeProjectMembershipsRepo().repo,
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000', 'project-1')),
    ).resolves.toBe(true);
  });

  it('allows an org member who is a project admin on this project', async () => {
    const { repo: projectMembershipsRepo, findOne: projectMembershipsFindOne } =
      makeProjectMembershipsRepo(
        jest.fn().mockResolvedValue({ role: ProjectMembershipRole.ADMIN }),
      );
    const guard = new ProjectRoleGuard(
      makeMembershipsRepo(
        jest.fn().mockResolvedValue({ id: 'm-1', role: MembershipRole.MEMBER }),
      ).repo,
      makeOrganisationsRepo().repo,
      projectMembershipsRepo,
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000', 'project-1')),
    ).resolves.toBe(true);
    expect(projectMembershipsFindOne).toHaveBeenCalledWith({
      where: { projectId: 'project-1', membershipId: 'm-1' },
    });
  });

  it('rejects an org member who is only a plain project member', async () => {
    const guard = new ProjectRoleGuard(
      makeMembershipsRepo(
        jest.fn().mockResolvedValue({ id: 'm-1', role: MembershipRole.MEMBER }),
      ).repo,
      makeOrganisationsRepo().repo,
      makeProjectMembershipsRepo(
        jest.fn().mockResolvedValue({ role: ProjectMembershipRole.MEMBER }),
      ).repo,
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000', 'project-1')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an org member who is not assigned to the project at all', async () => {
    const guard = new ProjectRoleGuard(
      makeMembershipsRepo(
        jest.fn().mockResolvedValue({ id: 'm-1', role: MembershipRole.MEMBER }),
      ).repo,
      makeOrganisationsRepo().repo,
      makeProjectMembershipsRepo(jest.fn().mockResolvedValue(null)).repo,
    );

    await expect(
      guard.canActivate(makeContext('user-1', '100000', 'project-1')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
