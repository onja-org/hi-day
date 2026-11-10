# Architecture decision records

Each file here records one decision and why it was made. Code comments link to these files by name, so a file is never renamed, renumbered or deleted, and its body is not rewritten. When a later decision replaces one, add a status line under the old one's title and link to the new one.

To add one, take the next free number (0035) and a short kebab-case file name that states the decision, such as `0035-invites-expire-after-a-week.md`. Start with a `#` title that says the decision as a sentence. Older ADRs open with `status:` frontmatter and use "Considered options" and "Consequences" sections. Newer ones skip the frontmatter and use sections like "The ask", "What this ADR decided" and "Not verified". Either is fine.

0009 has three ADRs and 0010 has two. They keep their file names because code links to them.

| No. | Decision | Status |
| --- | --- | --- |
| 0001 | [Plain pnpm workspaces, not Turborepo `apps/*`](0001-pnpm-workspaces-frontend-backend.md) | Accepted |
| 0002 | [Self-rolled password and JWT auth](0002-self-rolled-auth-for-registration.md) | Accepted |
| 0003 | [Setting a password is the email verification](0003-signup-verifies-by-setting-password.md) | Accepted |
| 0004 | [Organisation created with the first password](0004-organisation-created-atomically-with-first-password.md) | Accepted |
| 0005 | [Role checks re-read the database, not the JWT](0005-role-checks-reresolve-from-database-not-jwt.md) | Accepted |
| 0006 | [Server-authoritative timer, one running per Membership](0006-time-entries-single-running-timer-server-authoritative.md) | Partly superseded by 0022 |
| 0007 | [Manual time entries and idle handling](0007-manual-time-entries-and-idle-handling.md) | Partly superseded by 0028 |
| 0008 | [Manager scope from `Membership.teamId`](0008-manager-scope-uses-membership-team-id.md) | Superseded (Teams join table, no ADR) |
| 0009 | [Desktop signs in by pairing with the web](0009-desktop-device-pairing-replaces-password-login.md) | Partly superseded by 0017 |
| 0009 | [Pause and resume as a gap ledger](0009-manual-pause-resume-via-gap-ledger.md) | Superseded (pause now ends the entry, no ADR) |
| 0009 | [Window tracking with `get-windows`](0009-window-tracking-capture-settings-and-get-windows-integration.md) | Partly superseded by 0011, 0016, 0026 |
| 0010 | [App activity reporting](0010-app-activity-reporting.md) | Accepted |
| 0010 | [URL session ingest and display](0010-url-session-ingest-and-display.md) | Accepted |
| 0011 | [Window tracking moves to `@paymoapp/active-window`](0011-migrate-window-tracking-to-paymoapp-active-window.md) | Partly superseded by 0026 |
| 0012 | [Screenshots upload straight to Wasabi](0012-screenshot-capture-direct-to-wasabi-upload.md) | Accepted |
| 0013 | [Activity level tracking](0013-activity-level-tracking.md) | Accepted |
| 0014 | [Consent as a hard gate on capture](0014-consent-disclosure-as-hard-gate-on-capture.md) | Superseded by 0015 |
| 0015 | [Disclosure as a passive notice](0015-disclosure-as-passive-non-blocking-notice.md) | Accepted |
| 0016 | [GNOME Wayland window tracking via AT-SPI](0016-gnome-wayland-window-tracking-via-atspi.md) | Accepted |
| 0017 | [Web logout no longer revokes paired devices](0017-ordinary-logout-no-longer-revokes-paired-devices.md) | Accepted |
| 0018 | [Mutation responses carry a `message`](0018-mutation-responses-carry-message-added-by-hand.md) | Accepted |
| 0019 | [Toasts from one global mutation handler](0019-toast-notifications-via-global-mutation-cache.md) | Accepted |
| 0020 | [Desktop-facing controllers keep their raw shape](0020-desktop-facing-controllers-excluded-from-message-reshape.md) | Accepted |
| 0021 | [Organisation deletion is suspend, then purge](0021-organisation-deletion-soft-then-hard.md) | Accepted |
| 0022 | [One running timer per Device, hours are a union](0022-one-running-timer-per-device-hours-are-a-union.md) | Accepted |
| 0023 | [Owner can opt into an immediate purge](0023-owner-can-opt-into-immediate-purge.md) | Accepted |
| 0024 | [Timesheet reasons stored as text](0024-timesheet-reasons-stored-as-text.md) | Accepted |
| 0025 | [Desktop works offline from a cache](0025-desktop-agent-works-offline-from-a-remembered-cache.md) | Accepted |
| 0026 | [Linux app tracking reads X11 directly](0026-linux-app-tracking-reads-x11-directly-and-reports-its-health.md) | Accepted |
| 0027 | [Blind browsers and "URL unknown" time](0027-blind-browsers-at-runtime-and-unknown-url-time.md) | Accepted |
| 0028 | [Idle timeout holds tracking, sleep is idle](0028-idle-timeout-holds-tracking-and-sleep-counts-as-idle.md) | Accepted |
| 0029 | [A new working day starts the timer](0029-turning-the-machine-on-can-start-the-timer.md) | Accepted |
| 0030 | [Grace runs from the period end](0030-grace-runs-from-the-period-end-not-stripes-retries.md) | Accepted |
| 0031 | [Paying ends the trial that day](0031-paying-ends-the-trial-that-day.md) | Accepted |
| 0032 | [Renewal state lives in Stripe](0032-renewal-state-lives-in-stripe.md) | Accepted |
| 0033 | [Extra seats are charged on arrival](0033-extra-seats-are-charged-on-arrival.md) | Accepted |
| 0034 | [Deleting an Organisation stops its subscription](0034-deleting-an-organisation-stops-its-subscription.md) | Accepted |
