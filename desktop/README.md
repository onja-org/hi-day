# Hi Day Desktop

> **Renamed from "Workforce Monitor".** The app ID (`io.hiday.app`), Linux
> package/executable (`hiday`) and installer names (`hiday-*`) all changed
> with it, so the OS treats Hi Day as a *new* app: an existing Workforce
> Monitor install stays alongside it until uninstalled, users sign in and
> pair the device again, and macOS asks for its permissions again. Browser
> launcher overrides the old app wrote are still recognised (see
> `LEGACY_ACTIVATION_MARKERS` in `resolvers/linux/browser-activation.ts`).

The downloadable desktop agent. It handles login, device registration,
starting/stopping a timer against a Project (and optional Task), idle
detection/handling, active window tracking (the foreground app's name and
window title, sampled every 5s), and — as of this pass — screenshot
capture (the primary display, captured at an org-configurable frequency
and uploaded straight to object storage). Both window tracking and
screenshot capture are gated by their own org-level on/off setting **and**
only run while a timer is actually running — Hubstaff-style, tracking
follows being clocked in, not merely being logged in. **Activity level
isn't built yet.** That's deliberate scope for this pass; see
`docs/TECH_DESIGN.md` for where the rest of activity capture is headed.

A packaged build is meant to stay running with no babysitting: it starts
itself at login on every platform (`src/main/auto-launch.ts` — native
`app.setLoginItemSettings` on Windows/macOS, an XDG Autostart `.desktop`
entry on Linux via `src/main/linux-autostart.ts`), updates itself silently
on Windows/Linux-AppImage (`src/main/auto-updater.ts`, see the **Known
limitations** note on why macOS can't yet), and relaunches on its own if
the main process crashes, or just recreates its window if only the
renderer does (`src/main/crash-recovery.ts`) — either way the running timer
and any queued-but-unsent capture data survive, since neither ever lived
only in memory. See **Known limitations** below for the real edges of the
update/crash-recovery pieces (macOS auto-update, and native-segfault
recovery).

Window tracking, screenshots, and activity sampling are never blocked on
consent (see `docs/adr/0015-...`, which supersedes the earlier hard-gate
design in `docs/adr/0014-...`): capture starts as soon as its org setting
is on and a timer is running, same as everything else. If the org has
published disclosure text, the agent shows it as a persistent,
non-blocking notice banner alongside the normal login/timer UI — there is
no separate consent screen, and no "decline" option, since nothing is
gated on the answer.

Samples are batched and uploaded to the backend (`POST /device/app-events`,
every 60s) via `AppEventUploader` — the web console's Activity → Apps tab
shows a "time spent per app" summary for today, aggregated from these. See
`docs/adr/0010-...` for the reporting pipeline, `docs/adr/0009-...` for the
original `get-windows` integration, and `docs/adr/0011-...` for the
migration to `@paymoapp/active-window` (which also fixed the macOS title
gap `0009` had deliberately accepted — the permission that actually gates
window titles is Screen Recording, not Accessibility), and `docs/adr/0016-...`
for GNOME's Wayland gap being closed via AT-SPI2 (`GnomeWindowFocusTracker`,
`desktop/src/main/gnome-window-focus-tracker.ts`) rather than the extension
`0009` had originally deferred this to.

Screenshots are captured via Electron's own `desktopCapturer`
(`ScreenshotSampler`, `desktop/src/main/screenshot-sampler.ts` — no
third-party package, unlike window tracking) at the org's configured
`screenshotFrequencySeconds`, then taken straight through to object
storage by `ScreenshotUploader`: request a presigned upload URL from the
backend, PUT the JPEG bytes directly to Wasabi, then record the resulting
storage key as metadata. The backend never sees the image bytes. See
`docs/adr/0012-...` for the full design.

Both window-tracking and screenshot uploads go through an **offline
queue** (`OfflineQueue`/`OfflineQueueStore`, `desktop/src/main/offline-queue*.ts`):
every sample/capture is persisted to a local SQLite database
(`offline-queue.db`, in the same `userData` directory as the session file)
*before* any network request is attempted, and drained in batches on a
periodic, jittered tick (matching the batched-ingest cadence in
`docs/TECH_DESIGN.md` §4). A dropped connection just leaves data queued
rather than losing it, and a batch that fails to send (network down,
backend unreachable, no session) retries later with exponential backoff
plus jitter instead of being dropped — so many devices coming back online
at once don't all retry in lockstep. See the doc comment atop
`offline-queue.ts` for the one known limitation this doesn't close:
delivery is at-least-once, not exactly-once (a crash in the narrow window
between the backend durably accepting a batch and this process deleting
the local rows can resend that batch) — closing it needs an idempotency
key on the backend's ingest endpoints, out of scope for this pass.

**Login only ever happens in the web app** (`docs/adr/0009-...`) — the
desktop app itself has no password form. Clicking "Log in" opens the web
app in your system browser to approve the device; logging out of the web
app also signs this device out automatically, next time it talks to the
backend. See "Logging in" below.

**The window is frameless** (`frame: false` in `src/main/main.ts`): the
renderer draws its own sun title bar, which is the drag region, with
minimise and close buttons. Close **hides the window to the tray**, it does not
quit, so tracking keeps running. Quit from the tray menu ("Quit Hi Day"),
which goes through the usual pause-on-quit path. Stock GNOME shows no tray
icons without the AppIndicator extension; there, launching Hi Day again
brings the hidden window back (single-instance lock → `showMainWindow`).
The status bar's compact button shrinks the window to a 360×72
always-on-top bar with just the timer and start/stop; an idle prompt or a
tracking error expands it back automatically.

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

5. **Test remote sign-out**: click **Sign out** on that device's row. The
   app sends a heartbeat (`POST /devices/heartbeat`) every 60s while
   logged in, so this takes effect live — within about a minute the app
   switches back to the login screen on its own, without needing you to
   trigger any action by hand.

6. **Test that logging out of the web app signs the desktop out too**
   (ADR-0009): while the desktop app is logged in and its status poll is
   running (every 15s), log out of the web console. Within ~15s the
   desktop app should drop back to the "Log in" view on its own, with
   "You've been signed out — please log in to continue." — no restart or
   manual action needed.

7. **Test session persistence**: quit and re-run `pnpm --filter desktop
   dev` — it should skip straight to the logged-in screen instead of
   showing the login view again.

8. **Test time tracking**: once logged in, press play — or click a
   Project in the list, and optionally pick a Task with the Task button —
   and the elapsed time should start ticking, polling
   `GET /device/time-entries/current` every 15s to stay in sync with
   whatever's actually running server-side. The one play/stop button ends
   the entry when pressed again (pausing *is* stopping now — see
   `pending-timer-ops.ts`); clicking a different Project switches to it.
   Starting a *second* timer while one is already
   running (e.g. from the web console's own start action, on the
   `organisations/:id/projects/:projectId/time-entries/start` route) shows
   the conflict and a **Stop the other timer and start this one** button
   instead of silently switching — see `docs/adr/0006-...` for why. The
   project list only shows Projects this account can log time against
   (`GET /device/projects` — org admin/manager sees every active Project;
   anyone else needs their own Project membership).

9. **Test window tracking**: toggle **Track window titles (desktop agent)**
   in the web console's org settings (`OrganisationSettingsForm`), *and*
   **Start timer** in this app (step 8) — both must be true for sampling to
   run; window tracking follows being clocked in, not merely being logged
   in. `CaptureSettingsGate` polls `GET /device/capture-settings` every 15s
   (and immediately on login/logout) and `TimerStatusGate` polls
   `GET /device/time-entries/current` every 15s (immediately on login/
   logout, and instantly on this app's own Start/Stop/switch actions).
   Samples aren't logged to this app's terminal — see step 10 to confirm
   sampling is actually happening via the web console instead. On a
   Wayland session (`$WAYLAND_DISPLAY` set) on GNOME, `@paymoapp/active-window`
   itself still produces nothing (X11-only), but `GnomeWindowFocusTracker`
   (see `docs/adr/0016-...`) fills in real `appName`/`title` via AT-SPI2 once
   you've switched focus at least once after the timer starts — the very
   first tick or two, before any window activation has been observed yet,
   still falls back to `titleUnavailableReason: 'not-exposed'` with both
   fields null. A non-GNOME Wayland session (or one with no working
   accessibility bus at all) gets that same `'not-exposed'` fallback
   permanently instead — this is a known, informational, un-fixable-from-here
   gap for those cases (no "Grant Access"-style button, since there's
   nothing to grant). macOS-specific behavior (the Screen Recording banner,
   "Grant Access", and the 15s grant-detection poll) needs a real Mac to
   verify — see `docs/adr/0011-...` for the migration that fixed
   `0009-...`'s known macOS title-reading gap (window titles are gated by
   Screen Recording access, not Accessibility — this app now checks and
   requests the right permission).

10. **Test app-activity reporting**: with window tracking running (step 9),
    wait at least 60s (`AppEventUploader`'s flush interval — stopping the
    timer flushes immediately instead of waiting) then open the web
    console's **Activity → Apps** tab
    (`/organisations/:id/activities/apps`). It should show today's foreground
    apps with time spent and percent used, aggregated from the uploaded
    samples — this is now the primary way to confirm window tracking is
    actually working, since samples aren't logged locally. See
    `docs/adr/0010-...` for the reporting pipeline.

11. **Test the update notice**: temporarily lower the `version` in
    `desktop/package.json` (e.g. to `0.0.1`), then `pnpm --filter desktop
    dev` — since that's older than the latest `desktop-v*` release on
    GitHub, a banner should appear under the title reading "Version X.Y.Z
    is available." with a **View update** button (opens the releases page)
    and a dismiss (**×**). Revert the version change afterward — this
    isn't a real version bump, just a way to trigger the "outdated" case
    locally, since your real dev build is normally the newest thing around.
    This only exercises the manual GitHub-check fallback (`update-checker.ts`)
    — `startAutoUpdater` (`src/main/auto-updater.ts`) no-ops entirely under
    `electron .` (`!app.isPackaged`), so the silent win/linux download path
    below can only be tested from a real packaged build against a real newer
    release, not from `pnpm dev`.

10. **Test screenshot capture**: toggle **Enable screenshots** in the web
    console's org settings (same form as step 8's window-tracking toggle),
    set a short frequency (e.g. 1 minute) to avoid a long wait, and
    **Start timer** — both must be true, same Hubstaff-style rule as
    window tracking. `CaptureSettingsGate`'s existing 15s poll picks up
    the change automatically (no separate poll — see docs/adr/0012-...).
    Like window tracking, nothing is logged to this app's own terminal;
    confirm it worked via the web console's Activity → Screenshots tab
    (`/organisations/:id/activities/screenshots`), which lists today's
    captures for the signed-in member with a thumbnail per screenshot. On
    macOS, granting Screen Recording via the same banner step 8 describes
    is required for screenshots too (same permission, one banner covers
    both — see docs/adr/0012-...). On a Wayland session, the same banner
    appears with different text ("Screenshots are off — needs a one-time
    screen access grant.") and **no** "Open System Settings" fallback
    button (there's no equivalent settings pane); clicking **Grant Access**
    calls the `org.freedesktop.portal.Screenshot` D-Bus portal directly
    (`screenshot-portal.ts` — not `desktopCapturer`/ScreenCast, which pops
    the OS's own "share your screen" picker on every call and has been
    observed to crash the app if that picker is canceled). Approve that
    one dialog once and every later tick captures silently — verified live
    against a real GNOME/Wayland session — with no repeat prompt.

12. **Test the passive disclosure notice** (see `docs/adr/0015-...`): in
    the web console's **Settings → Consent & disclosure** page, write some
    disclosure text and click **Publish**. With a capture setting already
    on (step 9 or 10), window tracking/screenshots/activity should already
    be running normally — publishing disclosure text never pauses or gates
    them. The next time this device reaches the logged-in screen (a fresh
    pairing, or `refreshDisclosureBanner`'s check on relaunch, or its next
    15s poll mid-session) it should show a non-blocking banner with that
    text above the timer, not instead of it. Click **Got it**: the banner
    should disappear, and confirm `POST /device/consent` recorded a
    `granted` `ConsentRecord` and a `device_consent.granted` `AuditLog`
    entry — purely for the record, since capture was already running
    throughout. Publish a *new* version while this device stays logged
    in: on its next 15s poll the banner should reappear with the new text
    (capture keeps running uninterrupted the whole time).

13. **Test auto-launch at login**: install a packaged build (`dist:linux`/
    `dist:win`/`dist:mac`, or a real installer on Windows/macOS — see
    **Building installers** below) and launch it once. On Windows, check
    Task Manager's **Startup apps** tab; on macOS, **System Settings →
    General → Login Items** — "Hi Day" should show up enabled in
    either, without you having flipped anything by hand. On Linux, instead
    check that `~/.config/autostart/io.hiday.app.desktop`
    exists and `Exec=` points at a real, runnable path (the mounted
    AppImage's own file if you ran the `.AppImage` directly, or
    `/opt/Hi Day/hiday` for a `.deb` install) — log
    out and back in (or reboot) to confirm the app actually launches on its
    own. `pnpm dev` never touches any of this (`app.isPackaged` guards it).

14. **Test the renderer-crash recovery**: with the app running
    (`pnpm --filter desktop dev`), open DevTools (renderer) and run
    `process.crash()` in its console. The window should disappear and a
    fresh one reopen within a second or two, back on whatever screen
    (logged-in/login) you were on — check the terminal for a `[renderer]
    gone: crashed` log line. A running timer should still show as running
    once the new window loads (it was never touched — only the window
    itself died, not the main process).

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
pnpm --filter desktop dist:win     # NSIS installer — build on Windows (or CI); needs the .NET 8 SDK on PATH
pnpm --filter desktop dist:mac     # dmg + zip — must build on macOS (or CI); needs Xcode command line tools
```

### Opening a test build on macOS

Mac builds are ad-hoc signed — signed, but with no Apple-verified publisher
(see **Unsigned** under **Known limitations**). macOS opens them once you
let it:

1. Open the `.dmg` and drag **Hi Day** into **Applications**. Use the
   `arm64` build on Apple Silicon and `x64` on Intel.
2. Open Hi Day. macOS refuses because the developer can't be verified —
   click **Done** (or **OK**).
3. Go to **System Settings → Privacy & Security**, scroll to **Security**,
   and click **Open Anyway** next to the Hi Day message. Confirm with your
   password. From then on it opens normally.

If macOS instead says Hi Day "is damaged and can't be opened" (common with
a build downloaded through a browser), clear the download quarantine flag
and open it again:

```bash
xattr -cr "/Applications/Hi Day.app"
```

An ad-hoc signature changes on every build, so after installing a new test
build macOS asks for Screen Recording, Accessibility and Automation again.

`electron-builder` can only reliably produce a Windows or macOS installer
on that OS (or in CI using the matching runner) — it isn't practical to
cross-compile all three from one Linux machine. `.github/workflows/desktop-build.yml`
builds all three in parallel via a GitHub Actions matrix
(`ubuntu-latest` / `windows-latest` / `macos-latest`); trigger it manually
from the Actions tab (`workflow_dispatch`) and grab the built installers
from the run's artifacts.

`dist:win` and `dist:mac` each build a native side-car before invoking
`electron-builder` — `WinResolver.exe` via `dotnet publish` and
`firefox-ax-helper` via `native/darwin/firefox-ax-helper-swift/build.sh`,
respectively (see the comments on both in `electron-builder.yml`). Don't
invoke `electron-builder` directly for these two platforms: it has no way
to produce that output itself, and a missing `extraResources` source is
not an error electron-builder surfaces — it just silently packages without
it. That's exactly what happened here before this was wired into the
`pnpm` scripts: every past Windows installer shipped with no
browser-address-bar URL tracking at all (the `extraResources` path also
pointed at the wrong directory — `native/win/` lives at the repo root, not
under `desktop/` — so it never resolved even when someone did run the
`dotnet publish` step by hand first), and every past macOS installer
shipped without the Firefox helper, matching the "unverified on real
macOS hardware" limitation below.

### App icon

The icon is the Hi Day sun mark — the same as the web app's favicon
(`frontend/src/app/icon.svg`; every brand file lives in
`frontend/public/brand/`). `build/icon.svg` is the source; the files
actually used are generated from it and committed:

- `build/icon.png` — 1024px, padded macOS-style. electron-builder turns it
  into the macOS `.icns`.
- `build/icons/NxN.png` — Linux, 16–512px, downscaled from `build/icon.png`.
  Must stay ≤512px: a lone 1024px icon isn't in hicolor's size list, so
  GNOME shows the generic gear in the launcher.
- `build/icon.ico` — Windows, 16–256px, from the full-bleed web SVG so it
  stays legible at small taskbar sizes.
- `src/main/assets/icon.png` — 512px, the `BrowserWindow` icon (Linux's
  window/taskbar icon, and `pnpm dev` on every OS).

If the mark or brand colour changes, re-render those from the SVGs
(any SVG rasteriser works) rather than editing the PNG/ICO files directly.

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

- **On Linux, running this app turns on the session's accessibility bridge
  (`org.a11y.Status.IsEnabled`) permanently, and never turns it back off.**
  See `docs/adr/0016-...`: this is what makes GNOME window tracking work at
  all under Wayland, but it's a real, user-visible, session-wide side
  effect — GNOME's own Accessibility quick-setting will show as on for as
  long as this app has run at least once in that session. Deliberately
  never reverted on quit, since another AT-SPI consumer (a real screen
  reader, or this app's own URL-tracking resolver) may depend on it staying
  on, and there's no reliable way to tell whether this app was the one that
  turned it on.
- **Unsigned.** No Apple notarization or Windows Authenticode certificate
  yet, so macOS Gatekeeper and Windows SmartScreen will both warn on
  install. Mac builds are ad-hoc signed so they can open at all — see
  **Opening a test build on macOS**. Signing is deferred, matching the earlier device-management
  ticket's scope-down — see `docs/TECH_DESIGN.md` §5 for the eventual plan.
- **Silent auto-update on Windows and Linux only.** `src/main/auto-updater.ts`
  wraps `electron-updater`, checking the same public releases repo every 4h
  (and once at launch) and silently downloading a newer release when found;
  the banner switches to "Restart now" once it's ready, or installs on the
  next normal quit either way (`autoInstallOnAppQuit`). **macOS still can't
  self-update** — Squirrel.Mac refuses to apply an update to an unsigned
  app, so mac keeps the older manual flow (`src/main/update-checker.ts`,
  checks GitHub and links to the releases page) until code signing lands —
  see the **Unsigned** note above. On Linux this also only works when
  actually running the **AppImage** build; a `.deb` install has no
  self-update path and falls back to the same manual banner. Safety is
  electron-updater's own: a downloaded update is verified against the
  release's published sha512 before it's ever applied, so a corrupt or
  tampered download is discarded rather than installed — there's no
  automatic *rollback* of a release that passed that check but turns out to
  be broken behaviorally, though; that's a "cut a new release" problem, not
  something the client can undo on its own. Unverified against a real
  Windows/macOS CI run — only exercised locally on Linux so far.
- **Auto-launch at login now covers all three platforms, via two different
  mechanisms.** `src/main/auto-launch.ts` uses `app.setLoginItemSettings`
  on Windows/macOS (Electron's own API, native to both). Electron has no
  equivalent on Linux, so `src/main/linux-autostart.ts` writes an XDG
  Autostart `.desktop` entry into `~/.config/autostart/` instead — the
  freedesktop-standard mechanism every mainstream desktop environment
  (GNOME, KDE, XFCE, Cinnamon, …) already honors, no root required. Written
  fresh on every launch of a packaged build (not just the first), which
  matters for an AppImage specifically: it re-resolves `$APPIMAGE` each
  time, so a stale entry from before a self-update can't point at a mount
  that no longer exists. Never runs under `electron .` (dev), which would
  otherwise register the dev binary itself as a login item. Removal
  (`disableLinuxAutostart`) exists and is tested but isn't wired to an
  uninstall hook yet — same as `removeBrowserActivation` in
  `resolvers/linux/browser-activation.ts`, which has the same gap.
- **A main-process crash relaunches automatically; a true native segfault
  doesn't.** `process.on('uncaughtException'/'unhandledRejection')` in
  `main.ts` relaunches the whole app (`src/main/crash-recovery.ts` caps
  this at 3 relaunches per rolling minute, so a crash that happens on every
  single startup doesn't loop forever), and a renderer-only crash
  (`render-process-gone`) just recreates the window without touching
  main-process state at all. Either way nothing is lost on restart: the
  session, the running timer, and the offline queue all already live on
  disk or on the server, never only in memory (see AuthStore,
  OfflineQueueStore, and the pause-before-quit flow). What this **can't**
  catch is a hard native crash (a segfault inside V8, Node, or a native
  addon) — that kills the process before any JS handler gets a chance to
  run, and nothing here supervises the process from *outside* it (no
  systemd/launchd/Scheduled-Task wrapper). That gap is a known, accepted
  limitation of this pass, not something silently assumed away.
- **`package.json`'s `author`/`homepage` are placeholders** (electron-builder
  requires both to produce a `.deb`). Replace with a real product contact
  before shipping this outside the team.
- **Session storage falls back to plaintext** if the OS has no available
  keyring (e.g. a Linux box with no `gnome-keyring`/`kwallet` running) —
  `safeStorage.isEncryptionAvailable()` covers the common case but isn't
  guaranteed everywhere.
- **`better-sqlite3` (used by url-capture's local store) is a native addon,
  and `pnpm test` and `pnpm dev`/packaging need it built for two *different*
  Node ABIs** — plain Node for vitest, Electron's own bundled Node for the
  app. `pnpm install` leaves it built for plain Node (so `pnpm test` works
  out of the box); `pnpm dev` rebuilds it for Electron automatically as
  part of the script (`rebuild:electron`) before launching. If you run
  `pnpm test` again right after `pnpm dev` and it fails with a
  `NODE_MODULE_VERSION` mismatch, run `pnpm --filter desktop rebuild:node`
  to flip it back. `dist:*` isn't affected — electron-builder rebuilds
  native deps for Electron itself as part of packaging.
- **The offline queue's delivery is at-least-once, not exactly-once** — see
  the "offline queue" paragraph above and the doc comment atop
  `offline-queue.ts` for the narrow crash window this leaves open, and why
  closing it needs a backend change out of scope here.
- **Lowering an org's screenshot retention isn't retroactive.** Each
  screenshot's deletion date is fixed at capture time from whatever
  `screenshotRetentionDays` was set then — shortening the setting later
  only affects screenshots captured after the change, not existing ones.
  See the `Screenshot` entity's own comment and `docs/adr/0012-...`.
- **Screenshot capture is unverified on real macOS hardware.** Nobody on
  this project has a Mac, so that side of the Screen Recording permission
  flow remains unverified.
- **Wayland screenshot capture goes through a different portal than X11/
  macOS, gated behind its own one-time grant** (`screenshot-portal.ts`,
  `ScreenshotSampler.captureBuffer()`): Electron's `desktopCapturer` goes
  through the xdg-desktop-portal ScreenCast API under Wayland (unlike X11,
  which needs no such round-trip), which would pop the OS's own "share your
  screen" picker on every single tick — and canceling that picker has been
  observed to crash the whole app — so it is never called there at all.
  Instead, Wayland captures go through the separate
  `org.freedesktop.portal.Screenshot` interface directly over D-Bus: a
  single request/response with no live stream to cancel out from under, so
  it doesn't share that crash. It only ever captures silently
  (`interactive: false`) once a person has clicked **Grant Access** in the
  capture-permission banner at least once (`setup-state.json`'s
  `waylandScreenshotGranted`, kept across sign-out, mirroring the macOS
  Screen Recording flow) —
  verified live against a real GNOME/Wayland session: one approved
  `interactive: true` call was enough for every later `interactive: false`
  call to keep capturing with no repeat dialog. KDE's portal backend is
  less consistently reported to remember that grant the same way GNOME's
  does, and hasn't been verified on this project — a tick there may simply
  keep emitting nothing (same "unlucky failure" fallback as any other
  capture error) rather than silently succeeding.
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
- **Wayland gave no app name either, not just no title — fixed on GNOME, still
  a real gap elsewhere.** Neither `get-windows` nor `@paymoapp/active-window`
  provides any window/app information at all under Wayland (both only
  support X11 on Linux, "for security reasons" per their docs). On GNOME,
  `GnomeWindowFocusTracker` (see `docs/adr/0016-...`) now fills this via
  AT-SPI2 instead, verified live against a real GNOME Wayland session — a
  sample only falls back to `{ appName: null, title: null,
  titleUnavailableReason: 'not-exposed' }` before the first window
  activation this session has seen, or on a non-GNOME Wayland session (or
  one with no working accessibility bus at all), where this remains an
  accepted gap matching this app's existing "Linux best-effort" support
  level (idle detection has the same caveat). See `docs/adr/0009-...` for
  the original deferral and `docs/adr/0016-...` for the fix.
