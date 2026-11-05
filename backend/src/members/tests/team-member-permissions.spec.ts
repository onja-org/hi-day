import { teamMemberActionRefusal } from '../team-member-permissions';

describe('teamMemberActionRefusal', () => {
  const admin = { isOrgAdmin: true, managesThisTeam: false };
  const teamManager = { isOrgAdmin: false, managesThisTeam: true };
  const bystander = { isOrgAdmin: false, managesThisTeam: false };

  it('lets an admin act on anyone, an admin included', () => {
    expect(teamMemberActionRefusal(admin, { isOrgAdmin: true })).toBeNull();
    expect(teamMemberActionRefusal(admin, { isOrgAdmin: false })).toBeNull();
  });

  it("lets a team's manager act on its ordinary people", () => {
    expect(
      teamMemberActionRefusal(teamManager, { isOrgAdmin: false }),
    ).toBeNull();
  });

  it('refuses a team manager an admin on their own team', () => {
    expect(teamMemberActionRefusal(teamManager, { isOrgAdmin: true })).toBe(
      'Only admins can modify another admin.',
    );
  });

  it('refuses anyone who does not manage the team', () => {
    expect(teamMemberActionRefusal(bystander, { isOrgAdmin: false })).toBe(
      "Only an admin or this team's manager can change its members.",
    );
  });
});
