---
status: accepted
---

# Self-rolled password + JWT auth for registration/login, superseding TECH_DESIGN.md's hosted-auth assumption

`docs/TECH_DESIGN.md` §7/§10 plans hosted auth via WorkOS or Clerk, explicitly marked "Confirm" — an open decision, never made. `backend/CLAUDE.md` accordingly blocks adding "authentication/authorization logic, guards, or a specific provider's dependencies without confirming the approach first." Company registration needs a working signup/login now, so we're building self-rolled password + JWT auth rather than waiting on that decision or picking a provider under time pressure. The WorkOS/Clerk line in `TECH_DESIGN.md` is superseded by this for the foreseeable future; revisit if enterprise SSO becomes a real near-term requirement.

## Consequences

`Membership` is 1-to-many off `User` (`CONTEXT.md`: a User can hold multiple Memberships, one per Organisation) and Membership/role is mutable state — a member can be removed or re-roled at any time. So the JWT is identity-only: it carries `sub` (userId) and `exp`, never `organisationId` or `role`. Every tenant-scoped request re-resolves the caller's Membership from the database rather than trusting a token claim, in keeping with the organisationId-scoping discipline `backend/CLAUDE.md` already requires for queries. Passwords are hashed with argon2id.

Session mechanics — access/refresh token split, revocation storage, cookie vs. other transport — are deliberately not decided here; this ADR only covers registration issuing a password and an identity token. Track that as a follow-up ADR when the login/session module is actually built.
