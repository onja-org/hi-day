import { Repository } from 'typeorm';
import { ProjectTeam } from '../database/entities/project-team.entity';
import { hasTeamProjectAccess } from './team-project-access.util';

function makeProjectTeamsRepo(getOne: jest.Mock) {
  const queryBuilder = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne,
  };
  return {
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
  } as unknown as Repository<ProjectTeam>;
}

describe('hasTeamProjectAccess', () => {
  it('returns true when a ProjectTeam row matches the project and membership', async () => {
    const repo = makeProjectTeamsRepo(
      jest.fn().mockResolvedValue({ id: 'project-team-1' }),
    );

    await expect(
      hasTeamProjectAccess(repo, 'project-1', 'membership-1'),
    ).resolves.toBe(true);
  });

  it('returns false when no ProjectTeam row matches', async () => {
    const repo = makeProjectTeamsRepo(jest.fn().mockResolvedValue(null));

    await expect(
      hasTeamProjectAccess(repo, 'project-1', 'membership-1'),
    ).resolves.toBe(false);
  });
});
