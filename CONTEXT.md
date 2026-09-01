# Workforce Monitoring Platform

A multi-tenant platform that tracks time and activity for organisations and their members.

## Language

### Tenancy & access

**Organisation**:
The tenant root. All data (users, memberships, teams, projects, and eventually time entries) belongs to exactly one Organisation.
_Avoid_: Tenant, company, account — "tenant-scoped" and "organisation-scoped" mean the same thing here, but Organisation is the canonical term.

**Organisation slug**:
A unique, system-generated identifier for an Organisation, distinct from its display `name`. Two unrelated Organisations can share the same display name ("Acme Inc" is not reserved) — the slug is what's actually unique, and what routing/URLs key off.
_Avoid_: assuming `name` is unique — it explicitly isn't.

**User**:
An individual's account/identity on the platform. Signing up collects the person's name/email *and* their Organisation's founding details (company name, address, optional website) in one form, but creates only the User — no password, no Organisation, no Membership yet. Those Organisation details sit pending on the User record until the person opens the link emailed to them and sets a password: that single act proves they own the email address (there is no separate "verify your email" step) *and* atomically creates the Organisation and their `admin` Membership in it. A User therefore never exists, mid-signup, with a password but no Organisation, or an Organisation but no password — both land together, or neither does.
_Avoid_: Account (ambiguous with Organisation), Member (that's Membership-scoped — a User isn't a "member" of anything until they hold a Membership)

**Membership**:
The join entity linking a User to an Organisation, carrying that user's Role (and optionally their Team) within that specific Organisation. A User can hold multiple Memberships, one per Organisation they belong to.
_Avoid_: UserOrg, OrgUser

**MembershipRole**:
The permission level a Membership holds within its Organisation: `admin`, `manager`, `member`, or `finance`. The full permission matrix per role still isn't defined — only one concrete rule exists so far (editing Organisation settings requires `admin`) — but the *enforcement mechanism* is: backend routes declare `@RequireRole(...)`, checked by `RoleGuard` against the caller's Membership re-fetched from the database on every request (never trusted off the JWT, which carries identity only — see ADR-0002). The frontend mirrors this with a `RequireRole` component that shows an access-denied message in place, without redirecting, for an authenticated User who simply lacks the role — redirecting is reserved for "not logged in at all" (see ADR-0005). "Owner" is not a distinct role — the PRD uses "Admin / owner" to mean the `admin` who registered the Organisation.
_Avoid_: UserRole, Permission, Owner (as a separate role)

**Team**:
A named grouping of Memberships within an Organisation, used to organise time and reports. Sits between Organisation and User in the tenancy hierarchy ("organisation → team → user"). Every Organisation gets one default Team (named "General") created automatically alongside it — an Organisation is never teamless, even before anyone's set up a real one.
_Avoid_: Group, Department

**Invitation**:
A pending request for someone to join an Organisation (and optionally a Team) with a given Role, sent by email, before they have a User account or Membership. Becomes a Membership once accepted.
_Avoid_: Invite (fine informally, but Invitation is canonical)

**Employee count**:
A self-reported headcount an admin can edit on the Organisation (e.g. "we grew from 12 to 40"). Informational only — not the same number as the count of Memberships in that Organisation, which is a computed, authoritative figure (used for billing/seats). The two will diverge in practice and both are needed.
_Avoid_: treating employee count and Membership count as interchangeable

### Work tracking

**Project**:
A unit of work within an Organisation that time is tracked against; may be marked billable with a rate. Contains Tasks.
_Avoid_: Client — no Client concept exists yet; a Project is not a customer record.

**Task**:
A unit of work within a Project that time and activity are attributed to.
_Avoid_: Ticket, Item

### Capture

**Device**:
A paired installation of the desktop agent (or, later, the browser extension or a mobile app) belonging to a User within an Organisation. Marked "managed" when company-controlled versus personal.
_Avoid_: Agent (the Agent is the software; a Device is the paired installation/record it produces)
