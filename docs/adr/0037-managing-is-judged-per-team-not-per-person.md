---
status: accepted
---

# Managing is judged per team, not per person

An admin reported that a manager could not see three people she ran a team with. The three lead a second team, Recruitment - Candidates, and leading it hid them everywhere — including Recruitment Team, where they are ordinary members and she is the lead. The old rule asked "does this person manage anything, and is their org role `member`?", a question about the person rather than about the team the two share, so one leadership anywhere removed them from every other team's roster.

## Decisions

- **The manager test is scoped to the shared team.** `canViewMembership()` now asks whether the target holds `isManager` on one of the teams the caller manages, not whether they hold it anywhere. Leading Candidates no longer hides you from whoever runs Recruitment Team.
- **The org `manager` role label stops deciding visibility.** It was a second, independent exclusion — anyone labelled `manager` was hidden whether or not they managed a team — and keeping it would have made the per-team scoping a no-op for exactly the people who prompted the change. Managing a team was already the grant for the *caller* side; it is now the only thing that matters on the target side too, admins aside.
- **Admins stay excluded by role, before team scope is considered.** Unchanged, and for a different reason from the above: this protects someone senior from the people they sit alongside, rather than sorting peers. An admin may join any number of teams without becoming watchable by whoever runs them.
- **Where the two halves collide, being an ordinary member wins.** If the target manages one team the caller manages *and* is an ordinary member of another, they are visible. "Co-managers don't watch each other" is kept, but narrowed to what it was protecting: two people whose only connection is running a team together. Once one of them is also simply a member of something the other runs, the ordinary member relationship is real and the roster should show it. We shipped the opposite reading first — managing any shared team hid you — and it failed on the first setup it met: a lead who managed both teams could not see the people who were ordinary members of one of them, which is the complaint that started this.
- **Both copies of the rule moved together.** The predicate lives in `canViewMembership()` and is mirrored by hand in the Members-list SQL (`listActiveForOrganisation`); the SQL now looks for the *existence* of a non-manager row on one of the scoped teams, and a test asserts that clause's shape so the two cannot drift silently.

## Consequences

- **Visibility can now run both ways between two people.** If Annie leads Recruitment Team and Leslie leads Recruitment - Candidates, and each is an ordinary member of the other's team, each can see the other's activity. That follows from judging per team and is intended; it was impossible under the old rule, where a single leadership made someone unwatchable by everyone.
- **It is asymmetric where the teams are.** Someone who manages every team they share with you cannot see you, while you — an ordinary member on one of them — are visible to them. That is the intended direction: the roster follows who is a member of what, not who outranks whom.
- **This widens what existing managers can see, with no migration and no opt-in.** Anyone who was hidden only because they led some other team becomes visible to their own team's leads on deploy.

## Not handled

- **Writes are still wider than reads for this case.** `assertManagerCanModify()` blocks only admins, never a co-manager, so a manager can change a co-manager's role or deactivate them while being unable to see them. That predates this change and is left as it was; `CONTEXT.md`'s claim that "writing is never wider than reading" remains false for this one path.
