# hiday product requirements

*v1, desktop-first. This file is the living PRD, so edit it directly. It began as a [Google Doc](https://docs.google.com/document/d/1l2zjTqDX7USvMf1qVAfRRm80OkXYCs0Kh4XlEf19qb8/edit?pli=1&tab=t.0) that stopped being synced on 2026-08-24. Status notes were last checked against the code in November 2026.*

hiday is workforce time tracking and productivity monitoring, built as a transparent alternative to tools like Hubstaff and Time Doctor. v1 is a web console plus a desktop agent. Mobile (phone location and GPS) comes in a later release.

A requirement marked "Planned" is not built yet. Open product questions are listed in Section 11.

## 1. Summary

Companies with remote, hybrid or distributed teams need to account for time, see how work time is spent, and turn that into payroll and client invoices. Existing tools do this, but they lean hard on surveillance and are weak on transparency. hiday offers the same accountability with consent first: full reliability on company-owned devices, honest best-effort behaviour on personal ones, and no covert tracking.

## 2. Problem & opportunity

- Managers of distributed teams lack a reliable, trustworthy record of time worked and how it maps to projects, tasks and billable hours.
- Incumbent tools feel covert, which erodes employee trust and creates legal exposure.
- Emerging-market and agency teams are underserved by tools priced and positioned for large Western enterprises.

The opportunity is a fairly priced product that keeps the accountability features buyers need and that a company can openly tell its team about.

## 3. Goals & non-goals

### Goals

- Ship a sellable v1 (web console + desktop agent) that reliably tracks time, apps, websites, screenshots and activity on managed devices.
- Make transparency first-class: a visible indicator and clear disclosure.
- Turn tracked time into reports, payroll and invoices with little manual work.
- Support 1,000 concurrent all-day users on modest infrastructure, with room to grow.

### Non-goals (v1)

- Mobile apps and phone location, GPS or geofencing. Deferred to a later release.
- Covert or hidden monitoring, and keystroke logging (the content of what is typed). Permanently out of scope.
- Deep third-party integrations beyond a small initial set.

## 4. Target users

| User | Role | What they need |
| --- | --- | --- |
| Admin / owner | Buys and configures the product | Set up the org, deploy the agent, control what is collected and retained, manage billing. |
| Manager | Oversees a team | See time, activity and project breakdowns, approve timesheets, run reports. |
| Team member | Is tracked | A clear picture of what is tracked, simple start/stop, a visible on-indicator. |
| Finance | Runs payroll and invoicing | Turn approved hours into pay and client invoices with correct rates and rounding. |

## 5. Success metrics

Targets are still to be set with the team (Section 11).

| Metric | Why it matters | Target |
| --- | --- | --- |
| Capture reliability on managed devices | The core promise | TBD (e.g. > 99% of expected intervals) |
| Activation (org reaches its first full tracked day) | Shows onboarding works | TBD |
| Agent crash-free sessions | Trust in the always-on agent | TBD (e.g. > 99.5%) |
| Timesheet-to-payroll conversion | Shows the money loop works | TBD |
| 30-day org retention | Product-market fit signal | TBD |

## 6. Scope

| In scope (v1) | Out of scope (v1) |
| --- | --- |
| Account setup: registration, login, members, teams, projects, roles | Mobile apps (iOS / Android) |
| Web console (admin, reports, timesheets) | Location / GPS / geofencing |
| Desktop agent (Windows, macOS; Linux best-effort) | Keystroke logging (content) |
| Time tracking, idle detection | Covert / hidden monitoring |
| App and window tracking | Browser extensions of any kind |
| Website (URL) tracking, read natively by the agent | Advanced integrations marketplace |
| Screenshots (configurable frequency and retention) | |
| Activity level (active vs. idle) | |
| Reports, payroll, invoicing | |
| Self-hosting, free for any team size, plus the paid hiday Cloud | |

## 7. Functional requirements

### 7.1 Account setup & onboarding (admin)

- FR-1 Company registration. An admin registers a new company (organisation), enters its details, and becomes its owner.
- FR-2 Secure login and account recovery. Users log in with email and password (SSO planned), with email verification and password reset. Sessions are secure. Email is verified by setting the password from the emailed link.
- FR-3 Invite and add members. Members are invited by email or invite link. Invitees accept, set a password and join, and pending and active states are visible. Decided: inviting is admin-only.
- FR-4 Roles and permissions. Admins assign org roles (admin, manager, member, finance) that gate what each user can see and do. Projects add their own roles: manager, member and viewer. A viewer can see a project but not track time on it.
- FR-5 Teams. Admins create teams and assign members, so time and reports can be organised by team. A member can belong to several teams.
- FR-6 Projects. Admins and managers create, edit and archive projects. Billable flags and rates are planned.
- FR-7 Tasks. Projects contain tasks that time and activity are attributed to.
- FR-8 Agent deployment and device pairing. Admins get install links, and each installed agent pairs to the organisation and appears in the console. Pairing goes through a logged-in web session. Managed-deployment guidance is planned.
- FR-9 Tracking configuration. Admins choose what is collected (each feature on or off), set screenshot frequency and retention, and write the disclosure text shown to staff.
- FR-10 Plan and seats. An admin starts a trial or picks a plan and manages seats. On hiday Cloud this is built: a 14-day trial with no card, then per-seat billing in Settings → Billing. Blocking access after the trial is planned. Self-hosted installs have no plans or seat limits.
- FR-11 Guided onboarding. Planned. A first-run checklist takes a new company from registration through inviting members, creating a project and installing the agent, to its first tracked time.

### 7.2 Time tracking

- FR-12 Users start and stop a timer tied to a project and task, from the web console or the desktop agent, kept in sync. Each device runs its own timer (ADR 0022).
- FR-13 Users add or edit time manually, and edits are auditable. Decided: admins can always add or edit entries by hand. Other members can when the Modify time setting allows it, set for the organisation or per member, and only on timesheets they can already see. Anyone can delete their own.
- FR-14 The agent detects idle time and can flag or subtract it based on org settings.

### 7.3 Activity capture (desktop agent)

- FR-15 The agent records the active application and window title at a regular interval.
- FR-16 The agent captures screenshots at an org-configurable frequency with configurable retention. Screenshots upload directly to object storage.
- FR-17 The agent computes an activity level: the share of 10-second segments in each 10-minute period that had any keyboard or mouse input. It never records what was typed.
- FR-18 The agent reads the active tab's URL from the browser itself, with no extension. When a browser is focused but its address can't be read (unsupported browser, missing permission, a browser started before the agent), the agent records the time as "URL unknown" rather than guessing.
- FR-19 The agent queues data locally when offline and syncs when the connection returns, with no data loss. Time tracking continues offline with no limit. Capture (apps, URLs, screenshots, activity) stops after 7 days without reaching the server.

### 7.4 Deployment & consent

- FR-20 The agent shows a visible indicator when tracking is active.
- FR-21 Disclosure and OS permission prompts (screen recording, accessibility, automation) are shown clearly. Decided: disclosure is a non-blocking notice. Capture starts when its setting is on and a timer runs, and the person's acknowledgement is recorded (ADR 0015).
- FR-22 Planned. On managed devices, admins can force-install and lock the agent so it cannot be disabled. On personal devices, features degrade to best-effort. Today anyone can quit the agent from its tray menu.
- FR-23 Admins control what is collected (per feature) and how long it is retained. Retention is configurable for screenshots only. Other data is kept until it is deleted.

### 7.5 Reporting & administration

- FR-24 Managers view time, activity, apps, websites and screenshots by user, team and project over a date range.
- FR-25 Planned. Dashboards read from pre-computed rollups so they stay fast at scale. They currently query raw data.
- FR-26 The system is multi-tenant (organisation → team → user) with role-based permissions (admin, manager, member, finance).
- FR-27 Planned. Managers review and approve timesheets. The approval settings exist but are greyed out as "coming soon".

### 7.6 Payroll & invoicing

- FR-28 Planned. Approved hours convert to pay using per-user or per-project rates, handling rounding, timezones and multiple currencies.
- FR-29 Planned. The system generates client invoices from billable hours and supports export. Reports can already be exported as CSV. The invoices in Settings → Billing are hiday's own charges to the customer, not client invoices.

## 8. Non-functional requirements

- Reliability. On managed devices, capture reliability is the headline promise. The always-on agent must survive crashes, restarts and dropped connections without losing data.
- Scale. Support 1,000 concurrent all-day users on modest infrastructure: batched ingest, direct-to-storage screenshot upload, background processing, pre-built rollups and staggered sync. Background workers and rollups are planned (see `TECH_DESIGN.md` §4).
- Security and privacy. Strict tenant isolation, encryption in transit and at rest, role-based access and configurable retention. Screenshots and URLs are personal data.
- Compliance. hiday provides the controls customers need to meet regional monitoring and data-protection laws (disclosure text, retention, export and delete). The customer is responsible for lawful use.

## 9. Platform support (v1)

- Desktop agent: Windows and macOS at full strength. Linux best-effort with known gaps.
- Website tracking: exact URLs on macOS for Safari and Chromium browsers. The displayed address-bar text on Windows, on macOS Firefox, and on Linux (GNOME on Wayland, or any window manager on Xorg). Window title only elsewhere.
- Web console: any modern browser.

## 10. Release plan

| Phase | Delivers | Status (Nov 2026) |
| --- | --- | --- |
| 0. Foundations | Monorepo, multi-tenant data model, auth, batched-ingest API, direct-to-storage uploads, background queue | Done, except the background queue |
| 1. Web + time | Web console, org/project/task management, manual timers and entry, timesheets, basic reports | Done |
| 2. Agent shell | Always-on desktop agent: timer sync, idle detection, offline queue, sync, auto-update | Done. No auto-update on macOS |
| 3. Capture | Apps/windows, then screenshots, then activity level, each signed and tested on real hardware | Built. Signing not done |
| 4. URL tracking | Native URL reading by the agent, no extension | Done |
| 5. Depth | Reporting depth, admin/retention/consent controls, screenshot-frequency settings, payroll and invoicing | Partly done. Payroll, invoicing and approvals planned |
| Later | Mobile app with location/GPS, optional native capture rewrite | Not started |

## 11. Assumptions & open questions

| Question | Current answer |
| --- | --- |
| Target segment | Assumed: distributed and remote teams and agencies, including emerging-market dev teams, on managed devices. Confirm. |
| Positioning | Assumed: a transparent, trust-first alternative to Hubstaff. Confirm. |
| Pricing model | Decided: per seat. hiday Cloud is $4 per seat a month or $42 a year, with a 14-day trial. Self-hosted is free. |
| Success-metric targets | Open. Placeholders in Section 5. |
| Auth / SSO | Decided: self-built email and password auth (ADR 0002). SSO is planned. |
| Payroll scope | Assumed: internal calculation and export, not paying people directly in v1. Confirm. |

## 12. Risks

- URL tracking brittleness. Reading the address bar depends on each browser's accessibility support, and a browser or OS update can break it. On macOS it needs permissions the person can refuse. On Linux a browser started before the agent can't be read. Mitigation: every reading carries a confidence level, unreadable time is kept as "URL unknown", and the Devices page shows when capture is degraded.
- Native capture breakage. OS and Electron updates can break the screenshot and window modules. Mitigation: version pinning, prebuilt binaries, re-testing after updates.
- Antivirus and SmartScreen warnings. Builds are unsigned today. Mitigation: code signing and notarization.
- Trust and legal exposure. Monitoring is sensitive. Mitigation: transparency by design, retention controls, clear disclosure.
- Screenshot storage cost. The one cost that grows with use. Mitigation: configurable frequency and retention.
