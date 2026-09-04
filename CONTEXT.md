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
A unit of work within an Organisation that time is tracked against, scoped by name unique within its Organisation (case-sensitive). Carries a Client, description, and colour as metadata; may be marked billable with a default rate; and has an Archived state. Contains Tasks and, separately, Project memberships.
_Avoid_: assuming rate implies billable, or vice versa — both are independent, optional fields.

**Client**:
A free-text label on a Project (e.g. "Acme Inc"), used for grouping and filtering — not its own record. Two Projects can carry the identical Client text with no relationship enforced between them; renaming a client means editing it on each Project individually. A dedicated Client entity (with its own identity, so a rename or typo doesn't fragment reporting) may replace this later, but doesn't exist yet.
_Avoid_: treating Client as a foreign key or assuming client names are deduplicated anywhere.

**Archived** (Project):
A Project's terminal-but-reversible state (`archivedAt` set). An Archived Project accepts no changes at all — not its own fields, not its Project memberships — until it's unarchived; reports and time-tracking history logged before archiving remain intact and visible throughout.
_Avoid_: implying Archived is a delete — nothing about an Archived Project's history is hidden or removed.

**Project membership**:
Grants an org Membership permission to log time against a specific Project, with an optional per-Membership rate that overrides the Project's default rate when set (falls back to the Project's rate otherwise; a Project with neither has no rate at all), and a Project membership role (`admin` or `member`) controlling what that person can do on *this* Project specifically. Assigning Teams to a Project instead of individual Memberships is planned but not yet built.
_Avoid_: confusing this with Membership (org-level) — a Project membership is a separate, per-Project grant layered on top of an existing Membership.

**Project membership role**:
`admin` or `member`, independent of the org-wide MembershipRole. A Project membership with role `admin` can manage that one Project — edit it, archive/unarchive it, add/remove/re-role its members — even when the person's org role is plain `member`; this is what makes it useful as a delegation mechanism rather than just a label. A plain `member` can only be assigned to (and, once built, log time against) the Project. Org `admin`/`manager` can always manage every Project regardless of Project membership role — Project membership role only ever *adds* access, never restricts an org admin/manager. Org-wide project management (the Projects list, creating new Projects) still requires an org `admin`/`manager` role — Project membership role only grants access scoped to that one already-existing Project, not the org-wide Projects list or creation.
_Avoid_: MembershipRole (that's the org-wide role on Membership — same admin/member-shaped vocabulary, different, independently-set field, scoped to one Project instead of the whole Organisation).

**Task**:
A unit of work within a Project that time and activity are attributed to. Belongs to exactly one Project for its whole life — it cannot be moved to a different Project. Carries an optional description, hour estimate, due date, and assignee, plus a status (`open` or `closed`, deliberately binary — no board/workflow states). Closing is reversible (a closed Task can be reopened), same spirit as a Project's Archived state. An Archived Project's Tasks are frozen — no create/edit/close/reopen — until it's unarchived.
_Avoid_: Ticket, Item; Subtask (no such concept exists — a Task is the finest-grained unit, it doesn't nest further)

**Task assignee**:
The single Project membership a Task is assigned to — not an org-wide Membership directly, and not a User directly. A Task can only be assigned to someone who already holds a Project membership on that same Project; unassigning (or removing that person from the Project) always leaves the Task simply unassigned, never in an invalid state.
_Avoid_: assuming any org member can be assigned — only existing Project members are eligible.

### Time tracking

**Time entry**:
A single completed or currently-running span of time, attributed to the org Membership it belongs to and (optionally) a Task within a Project the Membership can log time against — the same "org admin/manager, or a Project membership on this specific Project" rule used elsewhere for project-scoped access (see Project membership role), enforced identically for the web console and the desktop agent. `endedAt` unset means a timer is still running; the database enforces at most one running Time entry per Membership at once — starting a second one while one is already running is rejected (not auto-stopped), so hours never move to a different Project/Task without the person explicitly choosing to move them (see the `switch` action). Carries a `source` — `web`/`agent` for a live-started timer, or `manual` for one entered directly with an explicit start and end — and, for agent-started entries, the Device that started it. A completed entry can be edited by an org admin (anyone's, including their own) or manager (anyone's *except their own*) — a plain member/finance can't edit any entry, not even one they logged themselves; a manager is deliberately excluded from self-editing since they're the same role trusted to edit everyone else's (see Auditability). Anyone with access to a Project (the usual "admin/manager, or a Project membership" rule) can still log time directly via manual entry (web console only) for themselves. A still-running entry can't be edited, only stopped or switched. `GET .../time-entries` defaults to the caller's own entries; an admin/manager can pass another Membership's id to view (not just edit) that person's timesheet — a plain member/finance can only ever reach their own.
_Avoid_: assuming an Organisation's `id`/`organisationId` is safe to read off a Device row for an agent request — a shared machine's Device reflects whoever logged in *last*; agent-authenticated requests resolve the organisation (and user) from the DeviceSession the bearer token was actually issued for instead.

**Auditability** (Time entry):
Every manual Time entry and every edit to an existing one is recorded in the AuditLog — `time_entry.created_manually`, `time_entry.updated` (carrying a `changed` map of `{field: {from, to}}` for only the fields that actually changed; a no-op edit writes nothing), and a `time_entry.stopped` backdated by idle-discard carries `reason: 'idle'` and how much time was discarded. The AuditLog itself has no read-side yet (see Idle policy's own note on what isn't built) — the trail exists, but there's no UI to browse it.

**Idle policy** (Organisation):
An Organisation's chosen response to a Membership going idle mid-timer: `off`, `flag` (the desktop agent prompts the person to keep or discard the idle stretch — the default), or `auto_subtract` (the agent ends the timer at idle-start automatically, with a passive notice, no prompt). Lives on `Organisation.settings` (the same jsonb column `address`/`website` already use) as `idleHandling`/`idleThresholdMinutes`, editable only by an org admin via the existing organisation-settings update. `flag` is deliberately the default a newly-created Organisation gets, not `auto_subtract` — a false positive silently cutting real tracked time is the specific trust failure the epic's own risk notes call out.
_Avoid_: treating "idle detection" as reliably working everywhere it's deployed — it's built on Electron's `powerMonitor.getSystemIdleTime()`, which depends on the X11 XScreenSaver extension and does not reliably report idle time under Wayland Linux sessions (confirmed non-functional in this project's own dev environment); this is the same "Linux best-effort" caveat the desktop agent already carries elsewhere.

### Capture

**Device**:
A paired installation of the desktop agent (or, later, the browser extension or a mobile app) belonging to a User within an Organisation. Marked "managed" when company-controlled versus personal.
_Avoid_: Agent (the Agent is the software; a Device is the paired installation/record it produces)
