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
The permission level a Membership holds within its Organisation: `admin`, `manager`, `member`, or `finance`. The permission matrix is now defined for `admin`/`manager`/`member`: an admin sees and manages every active Membership and Activity in the Organisation, including changing any role and deactivating members (the Organisation must always keep at least one active admin — the last one can't be demoted or deactivated); a manager sees only the Memberships and Activity entries of the team(s) they manage (a manager who manages no team sees no one — not other teamless members), and can change role/deactivate for a member of a team they manage, but **admin access is off-limits to managers entirely** — a manager can neither modify a Membership that's currently `admin` nor grant the `admin` role to anyone, no matter whose team it is — and a manager can never modify their own Membership at all, even to demote or deactivate themselves (see Team-scoping below); a member sees only themselves — peers never see each other's Activity entries even on the same Team. `finance` remains explicitly unimplemented — no permission set exists for it, and it's excluded from assignment (`ASSIGNABLE_MEMBERSHIP_ROLES`). The *enforcement mechanism*: backend routes declare `@RequireRole(...)`, checked by `RoleGuard` against the caller's Membership re-fetched from the database on every request (never trusted off the JWT, which carries identity only — see ADR-0002); `RoleGuard` also rejects any caller with no active Membership in the Organisation at all, even on routes that don't require a specific role. The frontend mirrors this with a `RequireRole` component that shows an access-denied message in place, without redirecting, for an authenticated User who simply lacks the role — redirecting is reserved for "not logged in at all" (see ADR-0005). "Owner" is not a distinct role — the PRD uses "Admin / owner" to mean the `admin` who registered the Organisation.
_Avoid_: UserRole, Permission, Owner (as a separate role)

**Team-scoping** (manager):
What a manager's Membership-list and Activity visibility are limited to. A Membership can belong to zero, one, or many Teams via the `team_memberships(membershipId, teamId, isManager)` join table; a manager's scope is the set of teams where their own `team_memberships` row has `isManager = true`, and they see anyone sharing at least one of those teams (a manager who manages no team sees no one). This replaced the earlier interim single-team model described in docs/adr/0008 (now superseded) — the lookup was deliberately isolated in `getManagerScopeTeamIds()` so the multi-team rewrite touched that one function's implementation, plus a handful of call sites that needed to start eager-loading the `teamMemberships` relation. The same rule governs the Teams list itself: an admin sees every team in the Organisation, but anyone else (manager or member) only sees the team(s) they belong to — which also limits which team a manager's invite-form UI offers for a new invite (not backend-enforced).

**Team**:
A named grouping of Memberships within an Organisation, used to organise time and reports. Sits between Organisation and User in the tenancy hierarchy ("organisation → team → user"). Every Organisation gets one default Team (named "General") created automatically alongside it, and an Organisation must always retain at least one Team — deleting the last remaining one is rejected. A Membership may belong to zero, one, or many Teams, and may be a manager (`isManager`) of any subset of the teams it belongs to. Deleting a Team detaches its members (their Memberships and history are untouched) rather than deleting them. Creating, renaming, and deleting a Team is org `admin`-only. Managing a Team's membership (add/remove members, promote/demote a manager) is open to an org admin or that Team's own manager(s) — mirroring Project membership role's manager/member split. A plain member of a Team has read-only access: they can view the Team (and who's on it) but can't change anything about it or anyone's role.
_Avoid_: Group, Department

**Invitation**:
A pending request for someone to join an Organisation (and optionally a Team) with a given Role, sent by email, before they have a User account or Membership. Becomes a Membership once accepted.
_Avoid_: Invite (fine informally, but Invitation is canonical)

**TimeEntry**:
A manually-logged block of worked time — a start time, an end time, and an optional note — submitted by the User themselves. Not automated tracking (no idle detection, no screenshots, no desktop-agent capture); that would be a separate, future initiative. Same visibility rule as Activity: the author always; an admin for everyone; a manager for their own team (see Team-scoping above); peers never see each other's entries.
_Avoid_: Timesheet (that's the UI/space where TimeEntries are logged and viewed, not the entity itself)

**Employee count**:
A self-reported headcount an admin can edit on the Organisation (e.g. "we grew from 12 to 40"). Informational only — not the same number as the count of Memberships in that Organisation, which is a computed, authoritative figure (used for billing/seats). The two will diverge in practice and both are needed.
_Avoid_: treating employee count and Membership count as interchangeable

**Activity**:
An append-only, user-authored note ("what I'm working on" style) a member submits about themselves — not automated tracking (that's a future "activity matrix" ticket capturing real usage data). Visible to: the author always; an admin for everyone; a manager for their own team (see Team-scoping above). Peers never see each other's entries.
_Avoid_: Time entry, Activity log (as in automated tracking) — those don't exist yet.

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
Grants an org Membership permission to log time against a specific Project, with an optional per-Membership rate that overrides the Project's default rate when set (falls back to the Project's rate otherwise; a Project with neither has no rate at all), and a Project membership role (`manager` or `member`) controlling what that person can do on *this* Project specifically. There is no Project-level `admin` — only `manager`/`member`, mirroring how a Team has managers and members with no separate admin tier. Assigning Teams to a Project instead of individual Memberships is planned but not yet built.
_Avoid_: confusing this with Membership (org-level) — a Project membership is a separate, per-Project grant layered on top of an existing Membership.

**Project membership role**:
`manager` or `member`, independent of the org-wide MembershipRole. A Project membership with role `manager` can manage that one Project — edit it, archive/unarchive it, add/remove members, change other members' roles — even when the person's org role is plain `member`; this is what makes it useful as a delegation mechanism rather than just a label. A plain `member` has read-only access: they can see the Project (and any Team) they're assigned to, but cannot change anything about it or anyone's role. Org `admin`/`manager` can always manage every Project regardless of Project membership role — Project membership role only ever *adds* access, never restricts an org admin/manager. Creating a new Project still requires an org `admin`/`manager` role; *listing/viewing* Projects is open to every org role, scoped per-caller (an org admin sees every Project, everyone else sees only Projects — and Teams — they're themselves a member of).
_Avoid_: MembershipRole (that's the org-wide role on Membership — same manager/member-shaped vocabulary, different, independently-set field, scoped to one Project instead of the whole Organisation). Also avoid "Project admin" — it's "Project manager" now, to keep the term consistent with Team's manager/member model and avoid confusion with the org-wide `admin` role.

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
A paired installation of the desktop agent (or, later, the browser extension or a mobile app) belonging to a User within an Organisation. Marked "managed" when company-controlled versus personal. Pairing itself only ever happens by approving the device from an already-authenticated web session (see docs/adr/0009) — the agent never collects a password directly. Logging out of the web app (or resetting a password) revokes every DeviceSession for that user, not just the browser's own session; a device discovers this the next time it happens to call the backend (there's no push channel), and any timer it had running gets stopped server-side at that moment rather than left open forever.
_Avoid_: Agent (the Agent is the software; a Device is the paired installation/record it produces)

**Window tracking setting** (Organisation):
An org-level on/off switch, `windowTrackingEnabled` (boolean, defaults `false`), gating whether the desktop agent's local window/app sampling loop is *allowed* to run. Lives on `Organisation.settings` (the same jsonb column `address`/`website`/`idleHandling` already use), editable only by an org admin via the existing organisation-settings update. The desktop agent polls `GET /device/capture-settings` to pick up changes — there's no push channel — and re-checks it immediately on login/logout as well, so a signed-out device never samples. This setting being on isn't sufficient on its own: the sampling loop only actually runs while a Time entry is also currently running for that Membership (Hubstaff-style — tracking follows being clocked in, not merely being logged in), independently polled via the same `/device/time-entries/current` a running timer already uses elsewhere.
_Avoid_: assuming this setting alone is enough to start sampling — see the running-timer condition above.

**App event** / **App activity**:
A single foreground-app/window sample (`AppEvent` entity, `app_events` table) uploaded by the desktop agent's window tracking, batched every 60s (`POST /device/app-events`) — see the Window tracking setting entry above for what gates whether sampling happens at all. Attributed to the Membership signed in on the Device at sample time (same rule as Time entry). No raw-event read API exists — only an aggregated "time spent per app" summary for a given day (`GET .../app-events/summary/mine` for the caller's own, `GET .../memberships/:membershipId/app-events/summary` for admin/manager viewing someone else's, same visibility rule as Activity/Time entry), shown in the web console's Activity → Apps tab. "Time spent" is an approximation — each sample is assumed to represent a fixed 5s of foreground time, not a measured duration.
_Avoid_: confusing this with the **Activity** entity above (user-authored "what I'm working on" notes) — they're unrelated concepts that happen to share a nav section (Activity → Notes vs. Activity → Apps) because that's how this ticket was scoped, not because they're the same thing.

**Screenshot setting** (Organisation):
An org-level on/off switch plus two numbers — `screenshotsEnabled` (boolean, defaults `false`), `screenshotFrequencySeconds` (defaults 600 — 10 min), and `screenshotRetentionDays` (defaults 30) — gating and configuring the desktop agent's screenshot capture. Lives on `Organisation.settings` alongside `windowTrackingEnabled`/`idleHandling`, same mechanism and same `GET /device/capture-settings` endpoint the desktop agent already polled for window tracking (see docs/adr/0012-...). Same running-timer condition as Window tracking setting — `screenshotsEnabled` alone isn't sufficient, capture only runs while a Time entry is also currently running for that Membership.
_Avoid_: assuming a change to `screenshotRetentionDays` is retroactive — it only affects screenshots captured after the change (see Screenshot entry below).

**Screenshot**:
A single captured image of a Membership's primary display (`Screenshot` entity, `screenshots` table), uploaded by the desktop agent's screenshot capture — see the Screenshot setting entry above for what gates and paces it. The image bytes never touch the API: the agent requests a presigned URL and uploads the JPEG straight to Wasabi (S3-compatible object storage), then the agent POSTs only the resulting `storageKey` and capture time as metadata (docs/TECH_DESIGN.md §1/§4's "direct-to-storage" design). Attributed to the Membership signed in on the Device at capture time (same rule as AppEvent/Time entry). Each row's `keptUntil` is fixed at capture time from the org's `screenshotRetentionDays` *as it stood then* — an hourly cleanup job deletes both the row and the underlying object once `keptUntil` passes. No raw browsing API beyond per-day listings, same shape as App event (`GET .../screenshots/mine` for the caller's own, `GET .../memberships/:membershipId/screenshots` for admin/manager viewing someone else's, same visibility rule), shown in the web console's Activity → Screenshots tab; each listed screenshot carries its own presigned, time-limited *viewing* URL, never a permanent link.
_Avoid_: assuming lowering retention deletes existing screenshots sooner — see Screenshot setting above.
