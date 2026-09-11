# Workforce Monitor Desktop

The downloadable desktop agent. **It handles device registration,
starting/stopping a timer against a Project (and optional Task), and idle
detection/handling — activity capture (apps/windows, screenshots, activity
level) isn't built yet.** That's deliberate scope for this pass; see
`docs/TECH_DESIGN.md` for where activity capture is headed.

**Login only ever happens in the web app** (`docs/adr/0009-...`) — the
desktop app itself has no password form. Clicking "Log in" opens the web
app in your system browser to approve the device; logging out of the web
app also signs this device out automatically, next time it talks to the
backend. See "Logging in" below.

On approval, the app registers itself as a Device against your account
(see the backend's auto-registration flow in `backend/src/devices/`)
using a UUID generated on first run and persisted under Electron's
`userData` directory — not a hardware fingerprint.

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
   a "Log in" button.

   Electron needs a display to run — it won't launch headless in a
   container with no X server. If you're developing inside one, run the
   build (`pnpm --filter desktop build`) and unit tests (`pnpm --filter
   desktop test`) to verify, and defer launching the actual window to a
   machine with a desktop session.

3. **Log in.** You'll also need the web console running
   (`pnpm --filter frontend dev`, `http://localhost:3000`) with an account
   to approve against — either an existing one, or a fresh signup at
   `http://localhost:3000/signup`.

   Click **Log in** in the desktop app. It opens `/link-device?code=...` in
   your system browser (logging you in first if you weren't already), and
   the desktop app shows "Waiting for you to approve in your browser…"
   while it polls. Approve the device on that page — the desktop app picks
   it up within a few seconds and shows the logged-in screen. This
   registers the app as a Device on that account.

4. **Verify registration** in the web console's org **Devices** page
   (sidebar): a new row should appear with platform `Linux`/`macOS`/
   `Windows`, this machine's hostname, and status `Active`.

5. **Test remote sign-out**: click **Sign out** on that device's row, then
   trigger any action in the desktop app that hits `/devices/*` (e.g. the
   Log out button, or restart the app). It should be rejected — there's no
   background heartbeat yet, so this only surfaces on the next explicit
   request, not live.

6. **Test that logging out of the web app signs the desktop out too**
   (ADR-0009): while the desktop app is logged in and its status poll is
   running (every 15s), log out of the web console. Within ~15s the
   desktop app should drop back to the "Log in" view on its own, with
   "You've been signed out — please log in to continue." — no restart or
   manual action needed.

7. **Test session persistence**: quit and re-run `pnpm --filter desktop
   dev` — it should skip straight to the logged-in screen instead of
   showing the login view again.

8. **Test time tracking**: once logged in, pick a Project (and optionally
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
