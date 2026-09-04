import { Membership } from '../database/entities/membership.entity';
import { MembershipRole } from '../database/entities/membership-role.enum';
import { canViewMembership } from './membership-visibility.util';

function makeMembership(overrides: Partial<Membership>): Membership {
  return {
    id: 'membership-1',
    role: MembershipRole.MEMBER,
    teamMemberships: [],
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
    const target = makeMembership({
      id: 'member-1',
      teamMemberships: [{ teamId: 'team-9', isManager: false }],
    } as Partial<Membership>);

    expect(canViewMembership(admin, target)).toBe(true);
  });

  it("allows a manager to view a member on the manager's own team", () => {
    const manager = makeMembership({
      id: 'manager-1',
      role: MembershipRole.MANAGER,
      teamMemberships: [{ teamId: 'team-1', isManager: true }],
    } as Partial<Membership>);
    const target = makeMembership({
      id: 'member-1',
      teamMemberships: [{ teamId: 'team-1', isManager: false }],
    } as Partial<Membership>);

    expect(canViewMembership(manager, target)).toBe(true);
  });

  it('allows a manager to view a member who is on both the managed team and another team', () => {
    const manager = makeMembership({
      id: 'manager-1',
      role: MembershipRole.MANAGER,
      teamMemberships: [{ teamId: 'team-1', isManager: true }],
    } as Partial<Membership>);
    const target = makeMembership({
      id: 'member-1',
      teamMemberships: [
        { teamId: 'team-1', isManager: false },
        { teamId: 'team-2', isManager: false },
      ],
    } as Partial<Membership>);

    expect(canViewMembership(manager, target)).toBe(true);
  });

  it('denies a manager viewing a member on a different team', () => {
    const manager = makeMembership({
      id: 'manager-1',
      role: MembershipRole.MANAGER,
      teamMemberships: [{ teamId: 'team-1', isManager: true }],
    } as Partial<Membership>);
    const target = makeMembership({
      id: 'member-1',
      teamMemberships: [{ teamId: 'team-2', isManager: false }],
    } as Partial<Membership>);

    expect(canViewMembership(manager, target)).toBe(false);
  });

  it('denies a teamless manager viewing anyone else', () => {
    const manager = makeMembership({
      id: 'manager-1',
      role: MembershipRole.MANAGER,
      teamMemberships: [],
    });
    const target = makeMembership({ id: 'member-1', teamMemberships: [] });

    expect(canViewMembership(manager, target)).toBe(false);
  });

  it('denies a member viewing a peer', () => {
    const member = makeMembership({
      id: 'member-1',
      teamMemberships: [{ teamId: 'team-1', isManager: false }],
    } as Partial<Membership>);
    const peer = makeMembership({
      id: 'member-2',
      teamMemberships: [{ teamId: 'team-1', isManager: false }],
    } as Partial<Membership>);

    expect(canViewMembership(member, peer)).toBe(false);
  });
});
