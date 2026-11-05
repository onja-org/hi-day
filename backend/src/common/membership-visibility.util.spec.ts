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

  it('allows whoever manages a team to view its members, org role aside', () => {
    const teamManager = makeMembership({
      id: 'member-lead',
      role: MembershipRole.MEMBER,
      teamMemberships: [{ teamId: 'team-1', isManager: true }],
    } as Partial<Membership>);
    const target = makeMembership({
      id: 'member-1',
      teamMemberships: [{ teamId: 'team-1', isManager: false }],
    } as Partial<Membership>);

    expect(canViewMembership(teamManager, target)).toBe(true);
  });

  it('denies a team manager viewing another manager of the same team', () => {
    const teamManager = makeMembership({
      id: 'member-lead',
      role: MembershipRole.MEMBER,
      teamMemberships: [{ teamId: 'team-1', isManager: true }],
    } as Partial<Membership>);
    const coLead = makeMembership({
      id: 'member-colead',
      role: MembershipRole.MEMBER,
      teamMemberships: [{ teamId: 'team-1', isManager: true }],
    } as Partial<Membership>);

    expect(canViewMembership(teamManager, coLead)).toBe(false);
  });

  it('denies the manager role on its own, with no team to manage', () => {
    const manager = makeMembership({
      id: 'manager-1',
      role: MembershipRole.MANAGER,
      teamMemberships: [{ teamId: 'team-1', isManager: false }],
    } as Partial<Membership>);
    const target = makeMembership({
      id: 'member-1',
      teamMemberships: [{ teamId: 'team-1', isManager: false }],
    } as Partial<Membership>);

    expect(canViewMembership(manager, target)).toBe(false);
  });

  it('denies a team manager viewing an admin who shares several of their teams', () => {
    const teamManager = makeMembership({
      id: 'member-lead',
      role: MembershipRole.MEMBER,
      teamMemberships: [
        { teamId: 'team-1', isManager: true },
        { teamId: 'team-2', isManager: true },
      ],
    } as Partial<Membership>);
    const admin = makeMembership({
      id: 'admin-1',
      role: MembershipRole.ADMIN,
      teamMemberships: [
        { teamId: 'team-1', isManager: false },
        { teamId: 'team-2', isManager: false },
        { teamId: 'team-3', isManager: true },
      ],
    } as Partial<Membership>);

    expect(canViewMembership(teamManager, admin)).toBe(false);
  });

  it('denies a manager viewing an admin on a team they manage', () => {
    const manager = makeMembership({
      id: 'manager-1',
      role: MembershipRole.MANAGER,
      teamMemberships: [{ teamId: 'team-1', isManager: true }],
    } as Partial<Membership>);
    const admin = makeMembership({
      id: 'admin-1',
      role: MembershipRole.ADMIN,
      teamMemberships: [{ teamId: 'team-1', isManager: false }],
    } as Partial<Membership>);

    expect(canViewMembership(manager, admin)).toBe(false);
  });

  it('denies a manager viewing another manager on a team they manage', () => {
    const manager = makeMembership({
      id: 'manager-1',
      role: MembershipRole.MANAGER,
      teamMemberships: [{ teamId: 'team-1', isManager: true }],
    } as Partial<Membership>);
    const peerManager = makeMembership({
      id: 'manager-2',
      role: MembershipRole.MANAGER,
      teamMemberships: [{ teamId: 'team-1', isManager: true }],
    } as Partial<Membership>);

    expect(canViewMembership(manager, peerManager)).toBe(false);
  });

  it('denies a manager viewing a manager who is only a member of their team', () => {
    const manager = makeMembership({
      id: 'manager-1',
      role: MembershipRole.MANAGER,
      teamMemberships: [{ teamId: 'team-1', isManager: true }],
    } as Partial<Membership>);
    const otherTeamsManager = makeMembership({
      id: 'manager-2',
      role: MembershipRole.MANAGER,
      teamMemberships: [
        { teamId: 'team-1', isManager: false },
        { teamId: 'team-2', isManager: true },
      ],
    } as Partial<Membership>);

    expect(canViewMembership(manager, otherTeamsManager)).toBe(false);
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
