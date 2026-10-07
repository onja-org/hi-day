# Hi Day

*Technical Design Document — v1, desktop-first*

This document describes the technical design for v1: a web console and a desktop agent, backed by a single multi-tenant backend. It reflects the desktop-first scope — the mobile app and location/GPS are deferred. The guiding principle is that most of the product is ordinary JavaScript; only the few pieces that must reach into the operating system use small native helpers, and those are isolated so they can be hardened or replaced without touching the rest.

## 1. Architecture overview

Two clients feed one backend. The desktop agent captures data — including website/URL activity, natively, with **no browser extension of any kind** (see `URL_TRACKING_CONTEXT.md` and `docs/url-tracking-plan.md` §7.3.1); the web console reads and administers it. The backend accepts batched events, offloads slow work to a queue, and stores metadata in Postgres and screenshots in object storage. Screenshots bypass the API and upload directly to storage.

## 2. Components

| Component | Built with | Responsibility |
| --- | --- | --- |
| Web console | Next.js | Admin, org/team/project management, reporting, timesheets, billing. |
| Backend API | NestJS + Postgres | Auth, multi-tenancy, batched event ingestion, presigned uploads, business logic. |
| Job queue | BullMQ + Redis | Async work: screenshot thumbnails, report aggregation. |
| Desktop agent | Electron + native helpers + native side-car resolvers | Time tracking, apps/windows, website/URL tracking, screenshots, idle; offline queue; sync. |
| Object storage | Cloudflare R2 (S3 API) | Screenshot blobs; cheap egress; direct uploads via presigned URLs. |
| Desktop agent | Electron + native helpers | Time tracking, apps/windows, screenshots, idle; offline queue; sync. |
| Browser extension | Manifest V3 | Reports the active tab URL to the agent, event-driven. |
| Object storage | Wasabi (S3 API) | Screenshot blobs; cheap egress; direct uploads via presigned URLs. |

## 3. Data model (core entities)

A generic *device* concept is kept from the start (desktop today, mobile later) so tables do not need reshaping when phones are added.

| Entity | Key fields | Notes |
| --- | --- | --- |
| organisation | id, name, settings | Tenant root. |
| user, membership | user_id, org_id, role | Roles: admin, manager, member, finance. |
| project, task | id, org_id, name | Time is attributed to these. |
| device | id, user_id, platform, managed | Desktop now; mobile later. |
| time_entry | user_id, project_id, start, end, source | Manual or agent-driven. |
| app_event | device_id, app, title, ts | Foreground app/window samples. |
| url_event | device_id, url, title, source, confidence, ts | From the native side-car resolver; see `docs/url-tracking-plan.md`. |
| screenshot | device_id, storage_key, ts, kept_until | Metadata only; blob lives in Wasabi. |
| rollup | scope, period, metrics | Pre-aggregated for dashboards. |

## 4. Event ingestion & processing

- **Batched ingest.** Agents accumulate events and POST them in batches (~every 60s), not per event — turning thousands of small requests into a light, steady stream.
- **Direct-to-storage screenshots.** The agent requests a presigned URL and uploads the image straight to Wasabi; only the metadata (storage key, timestamp) goes to the API. The API never carries image bytes.
- **Offline queue.** The agent persists unsent data locally (SQLite) and retries with backoff and jitter, so a dropped connection loses nothing and reconnects don't stampede the server.
- **Async processing.** Thumbnailing and rollup aggregation run on BullMQ workers, keeping ingestion and dashboards fast.
- **Pre-built rollups.** Dashboards read hourly/daily rollups rather than scanning raw events.

## 5. Desktop agent design

The agent is an Electron app whose first job is boring reliability; capture is layered on afterward, each module behind a feature flag.

- **Capture modules:** @paymoapp/active-window (apps/windows), the OS screenshot tool (screenshots), Electron powerMonitor (idle).
- **Always-on hygiene:** bounded memory, crash auto-restart, auto-launch on login, auto-update via electron-updater.
- **Permissions:** macOS Screen Recording (screenshots) and Accessibility (window titles, input) are requested transparently.
- **Native-module discipline:** pin versions, ship prebuilt binaries, re-test on real Windows/macOS after any OS or Electron update.
- **Signing:** Apple notarization and a Windows Authenticode (ideally EV) certificate from day one, to avoid antivirus/SmartScreen flags.

## 6. Website (URL) tracking design

**No browser extension — this is a deliberate, hard constraint, not an oversight.** See
`URL_TRACKING_CONTEXT.md` for the full list of forbidden approaches (extension, CDP/remote
debugging, TLS interception, browser history DB reads, packet/DNS sniffing) and
`docs/url-tracking-plan.md` for the complete design. Summary:

- **Native side-car resolvers, one per OS**, spawned once by the Electron main process and
  spoken to over a pinned JSON-lines protocol on stdin/stdout: `win-resolver.exe` (C#/.NET,
  `SetWinEventHook` + UI Automation), `mac-resolver` (osascript + a small Swift helper), and
  `linux-resolver` (Python, GNOME Shell Introspect + AT-SPI2).
- **Heartbeat re-read**, not navigation events, is what catches single-page-app route changes
  (the address bar updates on `history.pushState`; re-reading it every ~5s while a browser is
  focused is the whole trick).
- **Coverage varies by OS/browser.** Exact URLs (Apple Events) on macOS for Safari and all
  Chromium browsers; a normalized, rendered-address-bar string (`confidence: "displayed"`) on
  Windows (UIA) and Linux (AT-SPI2, GNOME-on-Wayland or any-WM-on-Xorg only); title-only
  fallback everywhere else. Every reading carries `source` and `confidence`.

## 7. Backend & multi-tenancy

- **Framework.** NestJS with Postgres. Every query is tenant-scoped by org_id; tenant isolation is enforced at the data-access layer.
- **Auth.** Hosted auth with enterprise SSO (WorkOS or Clerk) so SAML/SSO isn't a painful retrofit. Agents authenticate with per-device tokens.
- **APIs.** A batched ingest endpoint, a presigned-upload endpoint, and the console's read/admin APIs.

## 8. Storage & scale

At 1,000 concurrent all-day users the system sits comfortably on one modest server, one Postgres instance, one Redis, and one storage bucket. The load is shaped by design, not by horsepower.

- **Postgres.** Event tables partitioned by date; rollups pre-aggregated. TimescaleDB/partitioning only if raw-event volume later demands it.
- **Object storage.** Wasabi for screenshots — the one cost that grows with use, controlled by frequency and retention settings.
- **Redundancy.** Stateless API behind a load balancer (run 2+ instances); agents stagger sync with jitter to avoid thundering-herd spikes.

## 9. Security & privacy

- Encryption in transit and at rest; screenshots and URLs treated as personal data.
- Role-based access (admin, manager, member, finance) and strict tenant isolation.
- Configurable retention with export and delete, plus a visible tracking indicator and install-time consent.

## 10. Tech stack summary

| Layer | Choice |
| --- | --- |
| Monorepo | pnpm + Turborepo (apps/web, apps/api, apps/desktop, packages/shared) |
| Web console | Next.js + Tailwind |
| Backend | NestJS + Postgres |
| Queue / cache | BullMQ + Redis |
| Object storage | Cloudflare R2 |
| Desktop agent | Electron + get-windows, screenshot-desktop, uiohook-napi |
| Website (URL) tracking | Native side-car resolvers — C#/.NET (Windows), osascript + Swift (macOS), Python (Linux); see `docs/url-tracking-plan.md` |
| Object storage | Wasabi |
| Desktop agent | Electron + @paymoapp/active-window, screenshot-desktop, uiohook-napi |
| Browser extension | TypeScript, Manifest V3 |
| Auth | WorkOS or Clerk |
| Local agent store | SQLite (offline queue) |

## 11. Deferred / open technical questions

- Mobile (React Native) app for location/GPS — deferred; the generic device model leaves room for it.
- Optional native (Rust/Tauri or Swift/C#) rewrite of the always-on capture, only if agent footprint becomes a problem.
- Hosting target (e.g. Railway) and CI/CD + signing pipeline details.
