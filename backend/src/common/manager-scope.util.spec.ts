import { Membership } from '../database/entities/membership.entity';
import { getManagerScopeTeamIds } from './manager-scope.util';

describe('getManagerScopeTeamIds', () => {
  it('returns the teams the manager manages', () => {
    const membership = {
      teamMemberships: [
        { teamId: 'team-1', isManager: true },
        { teamId: 'team-2', isManager: false },
        { teamId: 'team-3', isManager: true },
      ],
    } as Membership;

    expect(getManagerScopeTeamIds(membership)).toEqual(['team-1', 'team-3']);
  });

  it('returns an empty array when the manager has no team memberships', () => {
    const membership = { teamMemberships: [] } as unknown as Membership;

    expect(getManagerScopeTeamIds(membership)).toEqual([]);
  });

  it('returns an empty array when teamMemberships was not loaded', () => {
    const membership = {} as Membership;

    expect(getManagerScopeTeamIds(membership)).toEqual([]);
  });
});
