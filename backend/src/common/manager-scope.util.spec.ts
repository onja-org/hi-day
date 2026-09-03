import { Membership } from '../database/entities/membership.entity';
import { getManagerScopeTeamId } from './manager-scope.util';

describe('getManagerScopeTeamId', () => {
  it("returns the manager's own teamId", () => {
    const membership = { teamId: 'team-1' } as Membership;

    expect(getManagerScopeTeamId(membership)).toBe('team-1');
  });

  it('returns null when the manager has no team', () => {
    const membership = { teamId: null } as Membership;

    expect(getManagerScopeTeamId(membership)).toBeNull();
  });
});
