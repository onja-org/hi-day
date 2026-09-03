import { Membership } from '../database/entities/membership.entity';
import { MembershipRole } from '../database/entities/membership-role.enum';
import { canViewMembership } from './membership-visibility.util';

function makeMembership(overrides: Partial<Membership>): Membership {
  return {
    id: 'membership-1',
    role: MembershipRole.MEMBER,
    teamId: null,
    ...overrides,
  } as Membership;
}

describe('canViewMembership', () => {
  it('allows a caller to view themselves regardless of role', () => {
    const self = makeMembership({
      id: 'membership-1',
      role: MembershipRole.MEMBER,
    });

    expect(canViewMembership(self, self)).toBe(true);
  });

  it('allows an admin to view any other member', () => {
    const admin = makeMembership({ id: 'admin-1', role: MembershipRole.ADMIN });
    const target = makeMembership({ id: 'member-1', teamId: 'team-9' });

    expect(canViewMembership(admin, target)).toBe(true);
  });

  it("allows a manager to view a member on the manager's own team", () => {
    const manager = makeMembership({
      id: 'manager-1',
      role: MembershipRole.MANAGER,
      teamId: 'team-1',
    });
    const target = makeMembership({ id: 'member-1', teamId: 'team-1' });

    expect(canViewMembership(manager, target)).toBe(true);
  });

  it('denies a manager viewing a member on a different team', () => {
    const manager = makeMembership({
      id: 'manager-1',
      role: MembershipRole.MANAGER,
      teamId: 'team-1',
    });
    const target = makeMembership({ id: 'member-1', teamId: 'team-2' });

    expect(canViewMembership(manager, target)).toBe(false);
  });

  it('denies a teamless manager viewing anyone else', () => {
    const manager = makeMembership({
      id: 'manager-1',
      role: MembershipRole.MANAGER,
      teamId: null,
    });
    const target = makeMembership({ id: 'member-1', teamId: null });

    expect(canViewMembership(manager, target)).toBe(false);
  });

  it('denies a member viewing a peer', () => {
    const member = makeMembership({ id: 'member-1', teamId: 'team-1' });
    const peer = makeMembership({ id: 'member-2', teamId: 'team-1' });

    expect(canViewMembership(member, peer)).toBe(false);
  });
});
