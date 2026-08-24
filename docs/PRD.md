# Workforce Monitoring Platform

*Product Requirements Document (PRD) — v1, desktop-first*

This PRD defines the first release of a commercial workforce time-tracking and productivity-monitoring product — a transparent alternative to tools like Hubstaff and Time Doctor. v1 covers a web console and a desktop agent. Mobile (phone location / GPS) is explicitly deferred to a later release.

*Where product-level decisions are still open (exact target segment, pricing, and metric targets), they are marked as assumptions in Section 11 rather than treated as settled.*

*This file is the canonical, living PRD — edit it directly. It was synced from the team's [Google Doc draft](https://docs.google.com/document/d/1l2zjTqDX7USvMf1qVAfRRm80OkXYCs0Kh4XlEf19qb8/edit?pli=1&tab=t.0) on 2026-08-24; that Doc is no longer kept in sync.*

## 1. Summary

Companies with remote, hybrid, or distributed teams need to account for time, understand how work time is spent, and turn that into payroll and client invoices. Existing tools do this but are often heavy-handed on surveillance and weak on transparency. Our product delivers the same accountability features through a consent-first, managed-deployment model: full reliability on company-owned devices, honest best-effort behaviour on personal ones, and no covert tracking.

## 2. Problem & opportunity

- Managers of distributed teams lack a reliable, trustworthy record of time worked and how it maps to projects, tasks, and billable hours.
- Incumbent tools lean into covert-feeling surveillance, which erodes employee trust and creates legal exposure.
- Emerging-market and agency teams, in particular, are underserved by tools priced and positioned for large Western enterprises.

The opportunity is a transparent, fairly-priced product that keeps the accountability features buyers need while being something teams can actually be told about without revolt.

## 3. Goals & non-goals

### Goals

- Ship a sellable v1 (web console + desktop agent) that reliably tracks time, apps, websites, screenshots, and activity on managed devices.
- Make transparency and consent first-class, not an afterthought — a visible indicator and clear disclosure.
- Turn tracked time into reports, payroll, and invoices with minimal manual work.
- Support 1,000 concurrent all-day users on modest infrastructure, with room to grow.

### Non-goals (v1)

- Mobile apps and phone location / GPS / geofencing — deferred to a later release.
- Covert or hidden monitoring, and keystroke logging (content of what is typed) — deliberately out of scope, permanently.
- Deep third-party integrations beyond a small initial set.

## 4. Target users

| User | Role | What they need |
| --- | --- | --- |
| Admin / owner | Buys and configures the product | Set up the org, deploy the agent, control what is collected and retained, manage billing. |
| Manager | Oversees a team | See time, activity, and project breakdowns; approve timesheets; run reports. |
| Team member | Is tracked | A clear, honest picture of what is tracked; simple start/stop; a visible on-indicator. |
| Finance | Runs payroll / invoicing | Turn approved hours into pay and client invoices with correct rates and rounding. |

## 5. Success metrics

*Targets are placeholders to be set with the team (Section 11).*

| Metric | Why it matters | Target |
| --- | --- | --- |
| Capture reliability on managed devices | Core promise of the product | TBD (e.g. > 99% of expected intervals) |
| Activation (org reaches first full tracked day) | Proves onboarding works | TBD |
| Agent crash-free sessions | Trust in the always-on agent | TBD (e.g. > 99.5%) |
| Timesheet-to-payroll conversion | Proves the money loop | TBD |
| 30-day org retention | Product-market fit signal | TBD |

## 6. Scope

| In scope (v1) | Out of scope (v1) |
| --- | --- |
| Account setup: registration, login, members, projects, roles | Mobile apps (iOS / Android) |
| Web console (admin, reporting, timesheets) | Location / GPS / geofencing |
| Desktop agent (Windows, macOS; Linux best-effort) | Keystroke logging (content) |
| Time tracking, idle detection | Covert / hidden monitoring |
| App & window tracking | Advanced integrations marketplace |
| Website (URL) tracking via browser extension | On-premise / self-hosted deployment |
| Screenshots (configurable frequency & retention) | |
| Activity level (active vs. idle) | |
| Reports, payroll, invoicing | |

## 7. Functional requirements

### 7.1 Account setup & onboarding (admin)

- **FR-1** Company registration — an admin can register a new company account (organisation), enter company details, and become its owner.
- **FR-2** Secure login & account recovery — users log in with email and password (or SSO where configured), with email verification and password reset; sessions are secure.
- **FR-3** Invite & add members — admins and managers invite members by email; invitees accept, set a password and join the organisation, with pending and active states visible.
- **FR-4** Roles & permissions — admins assign roles (admin, manager, member, finance) that gate what each user can see and do.
- **FR-5** Teams — admins create teams and assign members so time and reports can be organised by team.
- **FR-6** Projects — admins and managers create, edit and archive projects, and mark them billable with rates where relevant.
- **FR-7** Tasks — projects contain tasks that time and activity are attributed to.
- **FR-8** Agent deployment & device pairing — admins get install links and managed-deployment guidance; each installed agent pairs to the organisation and appears in the console.
- **FR-9** Tracking configuration — before capture begins, admins choose what is collected (each feature on or off), set screenshot frequency and retention, and set the disclosure/consent text shown to staff.
- **FR-10** Plan & seats — during or after registration an admin selects a plan or starts a trial and manages seats; the account is usable within plan limits.
- **FR-11** Guided onboarding — a first-run checklist takes a new company from registration through inviting members, creating a project and installing the agent, to its first tracked time.

### 7.2 Time tracking

- **FR-12** Users can start/stop a timer tied to a project and task, from the web console or the desktop agent, kept in sync.
- **FR-13** Users can add or edit time manually; edits are auditable.
- **FR-14** The agent detects idle time and can flag or subtract it based on org settings.

### 7.3 Activity capture (desktop agent)

- **FR-15** The agent records the active application and window title at a regular interval.
- **FR-16** The agent captures screenshots at an org-configurable frequency, with configurable retention; screenshots upload directly to object storage.
- **FR-17** The agent computes an activity level (relative keyboard/mouse volume) — never the content of keystrokes.
- **FR-18** A browser extension reports the active tab's URL to the agent; when a browser is active but no URL is available (private window, unsupported browser, extension missing), the agent records "browser active, URL unknown" rather than guessing.
- **FR-19** The agent queues data locally when offline and syncs when the connection returns, with no data loss.

### 7.4 Deployment & consent

- **FR-20** The agent shows a visible indicator when tracking is active.
- **FR-21** Consent is requested at install; the OS permission prompts (screen recording, accessibility) are surfaced clearly.
- **FR-22** On managed devices, admins can force-install and lock the agent and extension so they cannot be disabled; on personal devices, features degrade to best-effort.
- **FR-23** Admins control what is collected (per feature) and how long it is retained.

### 7.5 Reporting & administration

- **FR-24** Managers can view time, activity, apps, websites, and screenshots by user, team, and project over a date range.
- **FR-25** Dashboards read from pre-computed rollups so they stay fast at scale.
- **FR-26** The system is multi-tenant: organisation → team → user, with role-based permissions (admin, manager, member, finance).
- **FR-27** Managers can review and approve timesheets.

### 7.6 Payroll & invoicing

- **FR-28** Approved hours convert to pay using per-user or per-project rates, handling rounding, timezones, and multiple currencies.
- **FR-29** The system generates client invoices from billable hours and supports export.

## 8. Non-functional requirements

- **Reliability.** On managed devices, capture reliability is the headline promise; the always-on agent must survive crashes, restarts, and dropped connections without losing data.
- **Scale.** Support 1,000 concurrent all-day users on modest infrastructure: batched ingest, direct-to-storage screenshot upload, background processing, pre-built rollups, staggered sync.
- **Security & privacy.** Strict tenant isolation, encryption in transit and at rest, role-based access, and configurable retention. Screenshots and URLs are treated as personal data.
- **Compliance.** The product provides the controls (disclosure text, retention, export/delete) customers need to meet regional monitoring and data-protection laws; the customer remains responsible for lawful use.

## 9. Platform support (v1)

- **Desktop agent:** Windows and macOS at full strength; Linux best-effort with known gaps.
- **Browser extension:** one build for Chrome / Edge / Brave / Opera / Arc; a Firefox variant. Safari deferred.
- **Web console:** any modern browser.

## 10. Release plan

| Phase | Delivers |
| --- | --- |
| 0 — Foundations | Monorepo, multi-tenant data model, auth, batched-ingest API, direct-to-storage uploads, background queue. |
| 1 — Web + time | Web console, org/project/task management, manual timers & entry, timesheets, basic reports. |
| 2 — Agent shell | Reliable always-on desktop agent: timer sync, idle detection, offline queue, sync, auto-update. No capture yet. |
| 3 — Capture | Apps/windows → screenshots → activity level, one at a time, each signed & tested on real hardware. |
| 4 — URL tracking | Manifest V3 extension, event-driven, managed force-install. |
| 5 — Depth | Reporting depth, admin/retention/consent controls, screenshot-frequency settings, payroll & invoicing polish. |
| Later | Mobile app + location/GPS; Safari; optional native capture rewrite. |

## 11. Assumptions & open questions

| Assumption / question | Current working answer |
| --- | --- |
| Target segment | Assumed: distributed / remote teams and agencies, including emerging-market dev teams; managed-device deployment for reliability. Confirm. |
| Positioning | Assumed: transparent, trust-first alternative to Hubstaff. Confirm. |
| Pricing model | Open — per-seat monthly assumed. To be decided. |
| Success-metric targets | Open — placeholders in Section 5. To be set with the team. |
| Auth / SSO | Assumed: hosted auth with enterprise SSO (WorkOS or Clerk). Confirm. |
| Payroll scope | Assumed: internal calculation + export, not direct payment processing in v1. Confirm. |

## 12. Risks

- **URL tracking brittleness.** Browser-dependent and removable on personal devices. Mitigation: managed force-install; document the capability boundary.
- **Native capture breakage.** OS/Electron updates can break screenshot/activity modules. Mitigation: version pinning, prebuilt binaries, re-test after updates.
- **Antivirus false-positives on input hooks.** Mitigation: code signing and notarization from day one.
- **Trust / legal.** Monitoring is sensitive. Mitigation: transparency by design, retention controls, clear disclosure.
- **Screenshot storage cost growth.** The one cost that scales with use. Mitigation: configurable frequency and retention.
