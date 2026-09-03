---
status: superseded
---

> **Superseded**: the Teams ticket this ADR anticipated has shipped. `Membership.teamId` is gone, replaced by the `team_memberships(membershipId, teamId, isManager)` join table this ADR predicted. `getManagerScopeTeamId` is now `getManagerScopeTeamIds`, returning every team the caller manages rather than at most one. The prediction that "only this one function needs to change" held for the scope *decision* logic, but turned out incomplete in one respect: five existing `Membership` lookups elsewhere (in `activities`, `timesheets`, and `memberships` services) also needed a `relations: { teamMemberships: true }` addition, since that relation isn't populated unless explicitly requested — unlike the scalar `teamId` column they replaced. This document is kept for history.

# A manager's scope is computed from `Membership.teamId`, not a real multi-team model

RBAC needed a concrete answer to "which members/activity can a manager see" now, but the real multi-team model (a `team_membership(user, team, is_manager)` join table, letting a manager manage several teams and a member belong to several) is a separate, not-yet-built Teams ticket. Rather than block this ticket on that one, or build throwaway multi-team plumbing against today's schema, manager scope is computed by one function, `getManagerScopeTeamId(callerMembership)`, which today just returns `callerMembership.teamId` — the existing single, nullable team a Membership already carries. Every place that needs "is this within the manager's scope" (member-list filtering, activity visibility) calls this function, never `membership.teamId` directly.

## Consequences

A manager is scoped to exactly one team today, and a teamless manager (`teamId: null`) can't manage anyone via team-scoping. This is a known, temporary limitation, not a design goal: when the Teams ticket ships its real multi-team join table, only `getManagerScopeTeamId` (and its single-team assumption) needs to change — every call site stays the same. Without this ADR, a future reader would reasonably wonder why manager-scope logic doesn't match Teams' multi-team model; this is why.
