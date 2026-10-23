import { MembershipRole } from '../database/entities/membership-role.enum';
import { MembershipStatus } from '../database/entities/membership-status.enum';
import { countBilledSeats, isBilledSeat } from './billed-seats';

const active = (role: MembershipRole) => ({
  status: MembershipStatus.ACTIVE,
  role,
});

describe('isBilledSeat', () => {
  // Every org role can open the timer: tracking requires no particular role.
  it.each([
    MembershipRole.ADMIN,
    MembershipRole.MANAGER,
    MembershipRole.MEMBER,
    MembershipRole.FINANCE,
  ])('bills an active %s', (role) => {
    expect(isBilledSeat(active(role))).toBe(true);
  });

  it('does not bill a deactivated membership', () => {
    expect(isBilledSeat({ status: MembershipStatus.DEACTIVATED })).toBe(false);
  });

  /**
   * A Project membership role of `viewer` stops time being logged against
   * that one project. The same person can track against another project, or
   * against none at all, so it cannot make them unbilled — the ticket's
   * "project viewers" are not a kind of person.
   */
  it('bills someone who is a viewer on a project, because they can still track', () => {
    expect(isBilledSeat(active(MembershipRole.MEMBER))).toBe(true);
  });
});

describe('countBilledSeats', () => {
  it('counts only the active ones', () => {
    expect(
      countBilledSeats([
        active(MembershipRole.ADMIN),
        active(MembershipRole.MEMBER),
        { status: MembershipStatus.DEACTIVATED },
      ]),
    ).toBe(2);
  });

  it('is zero for an organisation with nobody active', () => {
    expect(countBilledSeats([{ status: MembershipStatus.DEACTIVATED }])).toBe(
      0,
    );
  });

  // No minimum: a one-person organisation is billed for one person, not the
  // two Hubstaff would charge for.
  it('bills a sole admin for one seat', () => {
    expect(countBilledSeats([active(MembershipRole.ADMIN)])).toBe(1);
  });
});
