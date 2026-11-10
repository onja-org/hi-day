# hiday technical design

*v1, desktop-first. Updated November 2026 to match the code.*

hiday is a web console and a desktop agent on one multi-tenant backend. Mobile is deferred. Most of it is ordinary TypeScript. Only the pieces that reach into the operating system use native helpers, kept separate so they can be hardened or replaced on their own. Anything not built yet is marked "planned".

## 1. Architecture overview

Two clients feed one backend. The desktop agent captures data, including website (URL) activity, which it reads natively with no browser extension of any kind (see `URL_TRACKING_CONTEXT.md` and `docs/url-tracking-plan.md` §7.3.1). The web console reads and administers that data.

The backend accepts batched events and stores metadata in Postgres. Screenshots bypass the API and upload directly to object storage.

## 2. Components

| Component | Built with | Responsibility |
| --- | --- | --- |
| Web console | Next.js | Admin, org/team/project management, reports, timesheets, billing. |
| Backend API | NestJS + Postgres | Auth, multi-tenancy, batched event ingest, presigned uploads, billing, business logic. |
| Scheduled jobs | `@nestjs/schedule` crons, in the API process | Screenshot retention cleanup, the abandoned-timer sweeper, trial reminders, scheduled reports, organisation purge. |
| Desktop agent | Electron + native helpers + URL side-car resolvers | Timer, idle, apps/windows, URLs, screenshots, activity level; offline queue; sync. |
| Object storage | Wasabi (S3 API) | Screenshot blobs, uploaded directly through presigned URLs. |

A separate job queue (BullMQ + Redis) is planned for heavier async work such as thumbnails and report aggregation. Nothing uses Redis today.

## 3. Data model (core entities)

The generic device concept leaves room for mobile without reshaping tables. Captured data belongs to the Membership signed in on the device at capture time.

| Entity (table) | Key fields | Notes |
| --- | --- | --- |
| organisation | id, name, slug, settings | Tenant root. `settings` holds capture and timesheet policy. |
| user, membership | user_id, organisation_id, role | Org roles: admin, manager, member, finance. |
| team, team_membership | team_id, membership_id, is_manager | A membership can be on many teams. |
| project, project_membership, task | id, organisation_id, name | Project roles: manager, member, viewer. |
| device | id, user_id, platform, last_seen_at | Platforms include ios and android for later. |
| time_entry | membership_id, project_id, task_id, device_id, started_at, ended_at, source, type | Source is web, agent or manual. |
| app_event | membership_id, device_id, app_name, title, sampled_at | Foreground app/window samples. |
| url_session | membership_id, device_id, url, host, browser, started_at, ended_at, source, confidence | From the URL resolvers. See `docs/url-tracking-plan.md`. |
| activity_sample | membership_id, device_id, active_percentage, period_start, period_end | One row per 10-minute period. |
| screenshot | membership_id, device_id, storage_key, captured_at, kept_until | Metadata only. The image lives in Wasabi. |
| subscription | organisation_id, status, trial dates | Billing state. Only exists when billing is enabled. |

Planned: a `rollup` table (scope, period, metrics) pre-aggregated for dashboards, and a `managed` flag on device.

## 4. Event ingestion & processing

- Batched ingest. Agents accumulate events and POST them in batches, about every 60s, not one request per event. `POST /device/app-events` takes up to 1,000 events per batch.
- Direct-to-storage screenshots. The agent requests a presigned URL and uploads the image straight to Wasabi. Only the metadata (storage key, timestamp) goes to the API. The API never carries image bytes.
- Offline queue. The agent writes every app event, activity sample and screenshot to local SQLite (`offline-queue.db`) before sending it. It drains on a jittered 60s tick and retries failed batches with exponential backoff plus jitter, so a dropped connection loses nothing and reconnects don't stampede the server. Delivery is at-least-once, since ingest has no idempotency key yet. URL sessions have their own local store and sync queue. Offline timer starts and stops are replayed on reconnect (ADR 0025).
- Async processing (planned). Thumbnails and rollup aggregation are meant to run on queue workers. There are no thumbnails yet.
- Pre-built rollups (planned). Dashboards and reports currently query raw time entries and events.

## 5. Desktop agent design

The agent is an Electron app whose first job is boring reliability. Each capture module runs only when its org setting is on and a timer is running.

- Capture modules:
  - Apps/windows: `@paymoapp/active-window`, polled every 5s. On Linux the agent reads X11 directly (ADR 0026) and uses AT-SPI2 on GNOME Wayland (ADR 0016).
  - Screenshots: Electron's `desktopCapturer`, or the XDG desktop portal on Wayland (ADR 0012).
  - Idle: Electron `powerMonitor`, or GNOME's Mutter idle monitor on GNOME.
  - Activity level: the share of 10-second segments in each 10-minute period that had keyboard or mouse input, read from idle time (ADR 0013). No input hook and no keystroke content.
- Always-on hygiene: auto-launch on login, crash auto-relaunch, and silent auto-update via electron-updater on Windows and Linux AppImage. macOS auto-update is not built.
- Permissions: macOS Screen Recording (screenshots), Automation (browser URLs) and Accessibility (window titles, Firefox URLs) are requested openly.
- Native-module discipline: pin versions, ship prebuilt binaries, and re-test on real Windows and macOS after any OS or Electron update.
- Signing (planned): Apple notarization and a Windows Authenticode (ideally EV) certificate, to avoid antivirus and SmartScreen warnings. Builds are unsigned today, and macOS builds are only ad-hoc signed.

## 6. Website (URL) tracking design

There is no browser extension. This is a hard constraint, not an oversight. `URL_TRACKING_CONTEXT.md` lists every forbidden approach (extension, CDP/remote debugging, TLS interception, browser history reads, packet/DNS sniffing), and `docs/url-tracking-plan.md` has the full design. In short:

- One side-car resolver per OS, spawned by the Electron main process and spoken to over a pinned JSON-lines protocol on stdin/stdout:
  - Windows: `win-resolver.exe` (C#/.NET), `SetWinEventHook` for focus and UI Automation for the address bar.
  - macOS: a TypeScript resolver run by Electron in Node mode, using `osascript` (Apple Events), plus a small Swift helper that reads Firefox through the Accessibility API.
  - Linux: a TypeScript resolver using AT-SPI2 over D-Bus for both focus and the address bar. GNOME Shell Introspect turned out to be unusable.
- A heartbeat re-read every 5s while a browser is focused, not navigation events, is what catches single-page-app route changes. The address bar updates on `history.pushState`.
- Coverage varies by OS and browser. macOS gives exact URLs for Safari and Chromium browsers. Windows (UIA), macOS Firefox (AX) and Linux (AT-SPI2, GNOME on Wayland or any window manager on Xorg) give the displayed address-bar text (`confidence: "displayed"`). Elsewhere there is a title-only fallback (`guess`). A focused browser whose address can't be read is recorded as `unknown` time rather than dropped (ADR 0027). Every reading carries `source` and `confidence`.

## 7. Backend & multi-tenancy

- Framework. NestJS with Postgres through TypeORM. Every query is scoped by organisation id.
- Auth. Self-built email and password auth with JWTs and refresh tokens, hashed with argon2 (ADR 0002). Roles are re-read from the database on every request (ADR 0005). Enterprise SSO is planned.
- Devices. The agent pairs through a logged-in web session (ADR 0009) and then uses its own device token.
- Billing. Stripe, in `backend/src/billing`, off unless `BILLING_ENABLED` is exactly `true`. Off is the self-hosted default: no trial, no paywall, no Stripe setup, and the billing routes are not registered. hiday Cloud turns it on.
- APIs. Batched ingest endpoints, a presigned-upload endpoint, and the console's read and admin APIs.

## 8. Storage & scale

The target is 1,000 concurrent all-day users on one modest server, one Postgres instance and one storage bucket. The load is shaped by design, not by horsepower.

- Postgres. Partitioning event tables by date, and TimescaleDB, are planned only if raw-event volume demands it. Neither is in place.
- Object storage. Wasabi for screenshots. This is the one cost that grows with use, and it is controlled by the frequency and retention settings.
- Redundancy (planned). The API holds no session state, but its scheduled jobs run in-process with no lock, so running 2+ instances behind a load balancer first needs a single cron runner or a lock. Agents already stagger sync and retries with jitter to avoid thundering-herd spikes.

## 9. Security & privacy

- Encryption in transit and at rest. Screenshots and URLs are treated as personal data.
- Role-based access (admin, manager, member, finance) and strict tenant isolation. A manager sees only the members of teams they manage.
- Screenshot retention is configurable per organisation. Organisation deletion is a suspend-then-purge, confirmed by email (ADR 0021).
- The agent shows a visible tracking indicator (tray icon, plus a taskbar overlay on Windows and a dock badge on macOS).
- Disclosure text, if an admin publishes it, is shown as a non-blocking notice and its acknowledgement is recorded. Capture does not wait for it (ADR 0015).

## 10. Tech stack summary

| Layer | Choice |
| --- | --- |
| Monorepo | pnpm workspaces (`frontend`, `backend`, `desktop`), Turborepo as task runner (ADR 0001) |
| Web console | Next.js + Tailwind |
| Backend | NestJS + Postgres + TypeORM |
| Scheduled jobs | `@nestjs/schedule` (BullMQ + Redis planned) |
| Object storage | Wasabi |
| Desktop agent | Electron + `@paymoapp/active-window`, `desktopCapturer`, electron-updater |
| Website (URL) tracking | Side-car resolvers: C#/.NET (Windows), TypeScript + osascript + Swift helper (macOS), TypeScript + AT-SPI2 (Linux) |
| Auth | Self-built email/password + JWT |
| Billing | Stripe, off by default |
| Local agent store | SQLite (offline queue, URL sessions) and a JSON cache |

## 11. Deferred / open technical questions

- A mobile app for location/GPS is deferred. The generic device model leaves room for it.
- An optional native rewrite of the always-on capture, only if the agent's footprint becomes a problem.
- Self-hosting runs on Docker Compose (`docs/SELF_HOSTING.md`). Open: the hosting setup for hiday Cloud, CI/CD, and the signing pipeline.
