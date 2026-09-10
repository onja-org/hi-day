# Workforce Monitor Desktop

The downloadable desktop agent. It handles login, device registration,
starting/stopping a timer against a Project (and optional Task), idle
detection/handling, and — as of this pass — active window tracking (the
foreground app's name and window title, sampled every 5s, gated by an
org-level on/off setting **and** only while a timer is actually running —
Hubstaff-style, tracking follows being clocked in, not merely being logged
in). **Screenshots and activity level aren't built
yet.** That's deliberate scope for this pass; see `docs/TECH_DESIGN.md` for
where the rest of activity capture is headed.

Samples are batched and uploaded to the backend (`POST /device/app-events`,
every 60s) via `AppEventUploader` — the web console's Activity → Apps tab
shows a "time spent per app" summary for today, aggregated from these. See
`docs/adr/0010-...` for the reporting pipeline, `docs/adr/0009-...` for the
original `get-windows` integration, and `docs/adr/0011-...` for the
migration to `@paymoapp/active-window` (which also fixed the macOS title
gap `0009` had deliberately accepted — the permission that actually gates
window titles is Screen Recording, not Accessibility).

**No offline queue yet** — a failed upload just drops that batch rather
than retrying or persisting it (same as the rest of the agent's network
calls today; see `docs/TECH_DESIGN.md`'s eventual offline-queue plan).

On first successful login, the app registers itself as a Device against
your account (see the backend's auto-registration flow in
`backend/src/devices/`) using a UUID generated on first run and persisted
under Electron's `userData` directory — not a hardware fingerprint.

## Running locally

1. **Start the backend** the app will log in against:

   ```bash
   nvm use 22 && pnpm --filter backend start:dev
   ```

   It listens on `http://localhost:3001` by default — that's what a
   *dev-mode* desktop app (`pnpm dev`, i.e. `electron .`) talks to. See
   "Which backend the app talks to" below for how a packaged/installed
   build picks its URL instead.

2. **Launch the desktop app:**

   ```bash
   nvm use 22 && pnpm --filter desktop dev
   ```

   This runs `pnpm build` then `electron .`. A window should open showing
   the login form.

   Electron needs a display to run — it won't launch headless in a
   container with no X server. If you're developing inside one, run the
   build (`pnpm --filter desktop build`) and unit tests (`pnpm --filter
   desktop test`) to verify, and defer launching the actual window to a
   machine with a desktop session.

3. **Log in** with any real account on that backend — either an existing
   one, or a fresh signup via the web console (`pnpm --filter frontend dev`,
   then `http://localhost:3000/signup`). On success the app registers
   itself as a Device on that account.

4. **Verify registration** in the web console's org **Devices** page
   (sidebar): a new row should appear with platform `Linux`/`macOS`/
   `Windows`, this machine's hostname, and status `Active`.

5. **Test remote sign-out**: click **Sign out** on that device's row, then
   trigger any action in the desktop app that hits `/devices/*` (e.g. the
   Log out button, or restart the app). It should be rejected — there's no
   background heartbeat yet, so this only surfaces on the next explicit
   request, not live.

6. **Test session persistence**: quit and re-run `pnpm --filter desktop
   dev` — it should skip straight to the logged-in screen instead of
   showing the login form again.

7. **Test time tracking**: once logged in, pick a Project (and optionally
   a Task) from the dropdowns and click **Start timer** — the elapsed time
   should start ticking, polling `GET /device/time-entries/current` every
   15s to stay in sync with whatever's actually running server-side.
   **Stop timer** ends it. Starting a *second* timer while one is already
   running (e.g. from the web console's own start action, on the
   `organisations/:id/projects/:projectId/time-entries/start` route) shows
   the conflict and a **Stop the other timer and start this one** button
   instead of silently switching — see `docs/adr/0006-...` for why. The
   project dropdown only lists Projects this account can log time against
   (`GET /device/projects` — org admin/manager sees every active Project;
   anyone else needs their own Project membership).

8. **Test window tracking**: toggle **Track window titles (desktop agent)**
   in the web console's org settings (`OrganisationSettingsForm`), *and*
   **Start timer** in this app (step 7) — both must be true for sampling to
   run; window tracking follows being clocked in, not merely being logged
   in. `CaptureSettingsGate` polls `GET /device/capture-settings` every 30s
   (and immediately on login/logout) and `TimerStatusGate` polls
   `GET /device/time-entries/current` every 15s (immediately on login/
   logout, and instantly on this app's own Start/Stop/switch actions).
   Samples aren't logged to this app's terminal — see step 9 to confirm
   sampling is actually happening via the web console instead. On a
   Wayland session (`$WAYLAND_DISPLAY` set) an informational note (no
   "Grant Access"-style button — there's no fix available) should appear
   in this app's own window instead of the Screen Recording banner —
   samples still get produced with `titleUnavailableReason: 'not-exposed'`,
   but with **both** `appName` and `title` null (neither `get-windows` nor
   `@paymoapp/active-window` provides any information at all under
   Wayland, not just no title — verified live; see `docs/adr/0009-...`),
   so they never reach step 9's summary either (dropped before upload, see
   `docs/adr/0010-...`). macOS-specific behavior (the Screen Recording
   banner, "Grant Access", and the 30s grant-detection poll) needs a real
   Mac to verify — see `docs/adr/0011-...` for the migration that fixed
   `0009-...`'s known macOS title-reading gap (window titles are gated by
   Screen Recording access, not Accessibility — this app now checks and
   requests the right permission).

9. **Test app-activity reporting**: with window tracking running (step 8),
   wait at least 60s (`AppEventUploader`'s flush interval — stopping the
   timer flushes immediately instead of waiting) then open the web
   console's **Activity → Apps** tab
   (`/organisations/:id/activities/apps`). It should show today's foreground
   apps with time spent and percent used, aggregated from the uploaded
   samples — this is now the primary way to confirm window tracking is
   actually working, since samples aren't logged locally. See
   `docs/adr/0010-...` for the reporting pipeline.

To test the actual packaged installer instead of the `electron .`
dev shortcut, see **Building installers** below and run the built
AppImage/`.deb` directly.

## Which backend the app talks to

`resolveApiBaseUrl` (`desktop/src/main/api-base-url.ts`) picks the API
base URL in this order:

1. `DESKTOP_API_URL`, if set — always wins. Point a local build or a
   one-off CI build at staging with this.
2. Otherwise, [`app.isPackaged`](https://www.electronjs.org/docs/latest/api/app#appispackaged):
   an installed `.exe`/`.dmg`/`.AppImage` defaults to the production API
   (`https://workfoce-monitoring-api.up.railway.app`); `electron .` (dev
   mode) defaults to `http://localhost:3001`.

This matters because an *installed* app has no way to inherit a
developer's shell environment — an env-var-only default would leave every
real user's copy silently trying (and failing) to reach `localhost`. If
the production API URL ever changes, update `PRODUCTION_API_URL` in
`api-base-url.ts` (and re-cut a release — there's no remote config or
auto-update yet, see **Known limitations** below).

## Building installers

```bash
pnpm --filter desktop dist:linux   # AppImage + .deb — works on Ubuntu, Pop!_OS, and most Debian-based distros
pnpm --filter desktop dist:win     # NSIS installer — build on Windows (or CI)
pnpm --filter desktop dist:mac     # dmg + zip — must build on macOS (or CI)
```

`electron-builder` can only reliably produce a Windows or macOS installer
on that OS (or in CI using the matching runner) — it isn't practical to
cross-compile all three from one Linux machine. `.github/workflows/desktop-build.yml`
builds all three in parallel via a GitHub Actions matrix
(`ubuntu-latest` / `windows-latest` / `macos-latest`); trigger it manually
from the Actions tab (`workflow_dispatch`) and grab the built installers
from the run's artifacts.

### Window tracking (`@paymoapp/active-window`) — packaging notes

`@paymoapp/active-window` ships prebuilt native N-API addons for all three
platforms via `prebuildify`/`node-gyp-build` (no `@mapbox/node-pre-gyp` or
similar download-on-install step, unlike `get-windows` — see
`docs/adr/0011-...`), and needed two non-obvious fixes to survive
packaging (both verified by actually running `pnpm --filter desktop
dist:linux`, unpacking the resulting asar, and executing
`@paymoapp/active-window`'s `getActiveWindow()` directly from the packaged
output — not just assumed from source-mode success):

- **`asarUnpack: ['node_modules/@paymoapp/active-window/**/*']`** in
  `electron-builder.yml` — a native `.node` addon can't be `require()`d
  from inside an asar archive.
- **`node-gyp-build` is a direct dependency of `desktop/package.json`**,
  even though nothing in this app's own code imports it — it's
  `@paymoapp/active-window`'s own runtime dependency (the thing that
  actually locates and loads the right platform prebuild), but
  electron-builder's dependency walker didn't pull it into the packaged
  `node_modules` on its own under this repo's pnpm-workspace layout,
  leaving a packaged build silently failing to load
  `@paymoapp/active-window` at all (`Cannot find module
  'node-gyp-build'`) despite working fine under `pnpm dev`. Declaring it
  directly resolves it, the same fix shape as `get-windows`'
  `@mapbox/node-pre-gyp` issue before it, if for a different underlying
  reason — see `docs/adr/0011-...` for the full story.
- **Still verify on macOS/Windows via the CI matrix above** — only the
  Linux target has been built and runtime-verified from this repo's own
  dev environment; `npmRebuild` (electron-builder's default `true`) ran
  successfully here, but hasn't been confirmed on the other two OSes.

## Known limitations (this pass)

- **Unsigned.** No Apple notarization or Windows Authenticode certificate
  yet, so macOS Gatekeeper and Windows SmartScreen will both warn on
  install. Signing is deferred, matching the earlier device-management
  ticket's scope-down — see `docs/TECH_DESIGN.md` §5 for the eventual plan.
- **No auto-update.** `electron-updater` needs a publish target (S3, GitHub
  Releases, etc.) that isn't set up. Every new version means a fresh
  manual download for now.
- **`package.json`'s `author`/`homepage` are placeholders** (electron-builder
  requires both to produce a `.deb`). Replace with a real product contact
  before shipping this outside the team.
- **No app icon yet.** Installers ship with Electron's default icon until
  brand assets are provided.
- **Session storage falls back to plaintext** if the OS has no available
  keyring (e.g. a Linux box with no `gnome-keyring`/`kwallet` running) —
  `safeStorage.isEncryptionAvailable()` covers the common case but isn't
  guaranteed everywhere.
- **No background heartbeat.** The app doesn't yet poll `/devices/heartbeat`,
  so a device stays "active" (per `computeDeviceStatus`) only as long as
  something else updates `lastSeenAt` — starting/stopping a timer doesn't
  touch it either; this is still open.
- **No offline queue.** Timer start/stop calls hit the backend directly and
  fail (with an on-screen error) if it's unreachable — the SQLite-backed
  offline queue described in `docs/TECH_DESIGN.md` isn't built yet.
- **Window-tracking uploads have no offline queue or retry.** A failed
  `POST /device/app-events` batch (network down, backend unreachable) is
  just dropped — not persisted, not retried. Wiring in the SQLite-backed
  offline queue described in `docs/TECH_DESIGN.md` is a follow-up ticket.
- **App-activity "time spent" is an approximation, not a measured
  duration.** Each sample is assumed to represent
  `DEFAULT_WINDOW_SAMPLE_INTERVAL_MS` (5s) of foreground time — see
  `docs/adr/0010-...`.
- **macOS window title reading now checks the permission that actually
  gates it.** `docs/adr/0009-...` originally recorded this as a
  deliberately-accepted gap: `get-windows` gates `title` on the Screen
  Recording permission, not Accessibility, but that pass checked/prompted
  for Accessibility only. The migration to `@paymoapp/active-window`
  (`docs/adr/0011-...`) fixed this as a side effect — that library's own
  permission model *is* Screen Recording (`requestPermissions()`), so the
  banner, "Grant Access" prompt, and status check all target the right
  permission now. Still unverified on real macOS hardware — nobody on this
  project has a Mac — so treat "does title actually populate once granted"
  as confirmed by the library's own docs, not by this repo's own testing.
- **Wayland gives no app name either, not just no title** — a known,
  deliberately-accepted gap, confirmed on real hardware (not just
  theoretical). Neither `get-windows` nor `@paymoapp/active-window`
  provides any window/app information at all under Wayland (both only
  support X11 on Linux, "for security reasons" per their docs), so a
  sample under Wayland is `{ appName: null, title: null,
  titleUnavailableReason: 'not-exposed' }` — the original ticket's
  acceptance criteria assumed app name would still be recorded here, but
  that isn't achievable through either library; a portable fix would need
  a compositor-specific approach (e.g. a GNOME/KDE D-Bus extension), well
  past this ticket's scope. Matches this app's existing "Linux
  best-effort" support level (idle detection has the same caveat). See
  `docs/adr/0009-...`.
