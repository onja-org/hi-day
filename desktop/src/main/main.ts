import { hostname as osHostname, release as osRelease } from 'node:os';
import { join } from 'node:path';
import { app, BrowserWindow, ipcMain, powerMonitor, shell } from 'electron';
import type { PairingPollResult, TrackingResult } from './api-client';
import { ApiClient } from './api-client';
import { resolveApiBaseUrl } from './api-base-url';
import { AuthStore } from './auth-store';
import { getOrCreateDeviceFingerprint } from './device-identity';
import { toDevicePlatform } from './platform';
import { resolveLinuxResolverPath } from './resolvers/resolver-paths';
import { applyBrowserActivation } from './resolvers/linux/browser-activation';
import { DebugHarness, NullDebugHarness, type DebugSink } from './url-capture/debug-harness';
import type { ResolverSpawnConfig } from './url-capture/resolver-manager';
import { ResolverOrchestrator } from './url-capture/resolver-orchestrator';
import type { UploadFn } from './url-capture/sync-contract';
import { UrlCaptureService } from './url-capture/url-capture-service';

/**
 * Linux is the only platform with a resolver on this branch — macOS and
 * Windows live on sandy/feat/url-tracking-on-remaining-os. Returning null
 * elsewhere makes startUrlCapture degrade to timer/idle tracking rather
 * than throwing or spawning nothing usable.
 */
function resolverSpawnConfigForPlatform(): ResolverSpawnConfig | null {
  if (process.platform === 'linux') {
    return {
      command: process.execPath,
      args: [resolveLinuxResolverPath()],
      // The resolver is compiled TypeScript inside the app's own dist/, not
      // a separate binary, so it runs on Electron's executable acting as a
      // plain Node process — no system Node install required. It needs no
      // resourcesPath hints: it spawns no child of its own, talking to the
      // accessibility bus directly over D-Bus.
      env: { ELECTRON_RUN_AS_NODE: '1' },
    };
  }

  return null;
}
import type { UpdateCheckResult } from './update-checker';
import { RELEASES_PAGE_URL, checkForUpdate } from './update-checker';

const NOT_LOGGED_IN: TrackingResult<never> = {
  ok: false,
  message: "You've been signed out — please log in to continue.",
  // Carries the same signal a 401 does. Without it the renderer treats this
  // as an ordinary error and leaves the timer and project list on screen —
  // the local session is already gone, so no retry can ever succeed.
  unauthorized: true,
};

const API_BASE_URL = resolveApiBaseUrl(app.isPackaged);

interface AuthStatus {
  loggedIn: boolean;
  email?: string;
  organisationName?: string;
}

interface StartPairingIpcResult {
  ok: boolean;
  message?: string;
}

/** The Project the timer last ran against — see AuthStore.rememberProject. */
interface LastProject {
  projectId: string;
  taskId: string | null;
}

// Otherwise userData resolves from package.json's "name" ("desktop"),
// producing a generic ~/.config/desktop directory — set explicitly now,
// before any installs exist, since changing it later orphans the stored
// fingerprint/session and makes every existing install re-register as a
// "new" device.
app.setName('Workforce Monitor');

let mainWindow: BrowserWindow | null = null;
let urlCaptureService: UrlCaptureService | null = null;
let resolverOrchestrator: ResolverOrchestrator | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let syncTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Set once IPC handlers are registered, so the app-lifecycle hooks below
 * (which are wired outside that function) can pause the running timer.
 */
let pauseRunningTimer: (() => Promise<void>) | null = null;
/** Guards the async pause during before-quit, which must not re-enter. */
let quitPauseComplete = false;

// Well under the backend's DEVICE_HEARTBEAT_WINDOW_MINUTES (5 min default —
// see backend/src/devices/device-status.ts) so a normal 60s scheduling
// jitter or one missed beat never flips a genuinely-running device to
// "offline" on the Devices page.
const HEARTBEAT_INTERVAL_MS = 60_000;

// Refreshes Device.lastSeenAt, which is otherwise set once at login — every
// device would flip to "offline" five minutes later while still running.
// Same lifecycle as startUrlCapture/stopUrlCapture.
function startHeartbeat(apiClient: ApiClient, deviceToken: string): void {
  stopHeartbeat();
  const beat = (): void => {
    void apiClient.heartbeat(deviceToken, app.getVersion());
  };
  beat(); // immediately — a fresh login shouldn't wait a full interval to show active
  heartbeatTimer = setInterval(beat, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// How often the pending URL-session queue uploads a batch — see
// desktop/src/main/url-capture/sync-queue.ts and
// docs/url-tracking-api.md. Nothing here is pinned to a specific
// cadence; this just keeps the local SQLite queue from growing unbounded
// between syncs without hammering the endpoint.
const SYNC_INTERVAL_MS = 30_000;

/**
 * The real network-backed `UploadFn` for a logged-in device. A 401 signs
 * out locally like callDeviceApi does, rather than leaving the queue
 * retrying against a revoked session.
 */
function buildUrlSessionUploadFn(
  apiClient: ApiClient,
  authStore: AuthStore,
  deviceToken: string,
): UploadFn {
  return async (batch) => {
    const result = await apiClient.syncUrlSessions(deviceToken, batch);
    if (result.ok) {
      return result.data;
    }

    if (result.unauthorized) {
      authStore.clear();
      stopUrlCapture();
      stopHeartbeat();
      stopSync();
      return { acked: [] };
    }

    // A 4xx other than 401 means the payload itself is wrong, so retrying
    // fails identically — a bug to surface, not a blip. A rejected batch is
    // indistinguishable from an offline one at the queue level, so without
    // this it fails silently. Logs batch size and status only, never a URL.
    const status = result.status;
    if (status !== undefined && status >= 400 && status < 500) {
      console.error(
        `[url-sync] Server REJECTED a batch of ${batch.length} session(s) with HTTP ${status}: ` +
          `${result.message} — this will not succeed on retry; the payload or the endpoint contract is wrong.`,
      );
    } else {
      // 5xx or a transport failure: genuinely worth retrying, so keep it
      // quiet enough not to spam a console during an ordinary outage.
      console.warn(
        `[url-sync] Batch of ${batch.length} session(s) did not sync` +
          `${status === undefined ? ' (server unreachable)' : ` (HTTP ${status})`}: ${result.message} — will retry.`,
      );
    }
    return { acked: [] };
  };
}

function startSync(): void {
  stopSync();
  syncTimer = setInterval(() => {
    void urlCaptureService?.runSync();
  }, SYNC_INTERVAL_MS);
}

function stopSync(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

// macOS and Windows: a real resolver side-car feeds focus/URL events in.
// Linux (Stage D) has no resolver yet, and resolverSpawnConfigForPlatform
// returns null there — this degrades to the same timer/idle/lock/suspend-
// only tracking as before on any unsupported platform, never throwing.
function startUrlCapture(deviceId: string, upload: UploadFn): void {
  urlCaptureService?.stop();
  resolverOrchestrator?.stop();

  urlCaptureService = new UrlCaptureService({
    deviceId,
    userDataDir: app.getPath('userData'),
    powerMonitor,
    logger: (line) => console.log(line),
    upload,
  });
  urlCaptureService.start();

  const spawnConfig = resolverSpawnConfigForPlatform();
  if (spawnConfig) {
    const service = urlCaptureService;
    resolverOrchestrator = new ResolverOrchestrator({
      spawnConfig,
      reportEvent: (event) => service.reportEvent(event),
      logger: (line) => console.log(line),
      debugSink: buildDebugSink(),
    });
    resolverOrchestrator.start();
  } else {
    resolverOrchestrator = null;
  }
}

// Opt-in only (URL_TRACKING_CONTEXT.md's pinned rule: "never log a full
// URL at info level or above... the debug log is opt-in") — an env var
// rather than a persisted setting for now, since this is a
// developer/support diagnostic, not an end-user-facing preference.
// Writes raw+normalized readings to userData, never to the regular log.
function buildDebugSink(): DebugSink {
  if (process.env.WORKFORCE_MONITOR_DEBUG_URL_CAPTURE !== '1') {
    return new NullDebugHarness();
  }
  return new DebugHarness(join(app.getPath('userData'), 'url-capture-debug.jsonl'));
}

function stopUrlCapture(): void {
  resolverOrchestrator?.stop();
  resolverOrchestrator = null;
  urlCaptureService?.stop();
  urlCaptureService = null;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 560,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}


function registerIpcHandlers(): void {
  const authStore = new AuthStore(app.getPath('userData'));
  const apiClient = new ApiClient(API_BASE_URL);

  // Set once a pairing request is started, cleared once it's claimed or
  // expires — the renderer's poll doesn't need to pass the code back on
  // every call, matching how it already doesn't pass the device token
  // back for tracking calls.
  let pendingPairingCode: string | null = null;

  ipcMain.handle('auth:status', (): AuthStatus => {
    const session = authStore.load();
    return session
      ? {
          loggedIn: true,
          email: session.email,
          organisationName: session.organisationName,
        }
      : { loggedIn: false };
  });

  ipcMain.handle(
    'auth:startPairing',
    async (): Promise<StartPairingIpcResult> => {
      const fingerprint = getOrCreateDeviceFingerprint(app.getPath('userData'));
      const result = await apiClient.startPairing({
        deviceFingerprint: fingerprint,
        platform: toDevicePlatform(process.platform),
        osVersion: osRelease(),
        hostname: osHostname(),
        appVersion: app.getVersion(),
      });

      if (!result.ok) {
        return { ok: false, message: result.message };
      }

      pendingPairingCode = result.code;
      await shell.openExternal(result.approvalUrl);
      return { ok: true };
    },
  );

  ipcMain.handle(
    'auth:pairingStatus',
    async (): Promise<PairingPollResult> => {
      if (!pendingPairingCode) {
        return { status: 'expired' };
      }

      const result = await apiClient.pollPairing(pendingPairingCode);

      if (result.status === 'approved') {
        pendingPairingCode = null;
        authStore.save({
          email: result.email,
          organisationName: result.organisationName,
          deviceId: result.deviceId,
          deviceToken: result.deviceToken,
        });
        // Approval is the new "just logged in" moment — the password
        // handler these hung off no longer exists.
        startUrlCapture(
          result.deviceId,
          buildUrlSessionUploadFn(apiClient, authStore, result.deviceToken),
        );
        startHeartbeat(apiClient, result.deviceToken);
        startSync();
      } else if (result.status === 'expired') {
        pendingPairingCode = null;
      }

      return result;
    },
  );

  ipcMain.handle('auth:logout', async (): Promise<AuthStatus> => {
    const session = authStore.load();
    if (session) {
      // Pause BEFORE revoking the session — afterwards the token is dead
      // and the running entry could never be paused, leaving it to run
      // unattended until the next login noticed it.
      await apiClient.pauseTimer(session.deviceToken);
      await apiClient.logout(session.deviceToken);
      authStore.clear();
    }
    stopUrlCapture();
    stopHeartbeat();
    stopSync();
    return { loggedIn: false };
  });

  /**
   * Every tracking:* call goes through this. On an unauthorized response
   * (missing, expired, or admin-revoked session) the local session is
   * cleared and capture stopped immediately, so a remote sign-out takes
   * effect on the next poll rather than at the next restart.
   */
  async function callDeviceApi<T>(
    call: (deviceToken: string) => Promise<TrackingResult<T>>,
  ): Promise<TrackingResult<T>> {
    const session = authStore.load();
    if (!session) return NOT_LOGGED_IN;

    const result = await call(session.deviceToken);
    if (!result.ok && result.unauthorized) {
      authStore.clear();
      stopUrlCapture();
      stopHeartbeat();
      stopSync();
    }
    return result;
  }

  // Exposed to the app-lifecycle hooks (quit/suspend/shutdown) so they can
  // pause rather than abandon a running timer. Pausing an entry that is
  // already paused, or when none is running, is a no-op the backend rejects
  // harmlessly — so callers never need to check first.
  pauseRunningTimer = async (): Promise<void> => {
    const session = authStore.load();
    if (!session) return;
    await apiClient.pauseTimer(session.deviceToken);
  };

  ipcMain.handle('tracking:listProjects', () => callDeviceApi((token) => apiClient.listProjects(token)));

  ipcMain.handle('tracking:listTasks', (_event, projectId: string) =>
    callDeviceApi((token) => apiClient.listTasks(token, projectId)),
  );

  // Remembering the Project on the way through means the renderer never has
  // to manage it: whatever the timer last actually started against is what a
  // later auto-start or play resumes to.
  ipcMain.handle('tracking:start', async (_event, projectId: string, taskId: string | null) => {
    const result = await callDeviceApi((token) => apiClient.startTimer(token, projectId, taskId));
    if (result.ok) authStore.rememberProject(projectId, taskId);
    return result;
  });

  ipcMain.handle('tracking:switch', async (_event, projectId: string, taskId: string | null) => {
    const result = await callDeviceApi((token) => apiClient.switchTimer(token, projectId, taskId));
    if (result.ok) authStore.rememberProject(projectId, taskId);
    return result;
  });

  ipcMain.handle('tracking:lastProject', (): LastProject | null => {
    const session = authStore.load();
    if (!session?.lastProjectId) return null;
    return { projectId: session.lastProjectId, taskId: session.lastTaskId ?? null };
  });

  ipcMain.handle('tracking:stop', (_event, endedAt?: string) =>
    callDeviceApi((token) => apiClient.stopTimer(token, endedAt)),
  );

  ipcMain.handle('tracking:status', () => callDeviceApi((token) => apiClient.getCurrentTimer(token)));

  ipcMain.handle('tracking:pause', () => callDeviceApi((token) => apiClient.pauseTimer(token)));

  ipcMain.handle('tracking:resume', () => callDeviceApi((token) => apiClient.resumeTimer(token)));

  ipcMain.handle('tracking:entriesBetween', (_event, from: string, to: string) =>
    callDeviceApi((token) => apiClient.listEntriesBetween(token, from, to)),
  );

  ipcMain.handle('tracking:idlePolicy', () =>
    callDeviceApi((token) => apiClient.getIdlePolicy(token)),
  );

  // Native, synchronous, and free of any network round-trip — the renderer
  // polls this on its own short interval while a timer is running.
  // See docs/adr/0007-... : unreliable under Wayland (X11 XScreenSaver
  // extension only), matching the desktop app's existing "Linux
  // best-effort" support level.
  ipcMain.handle('idle:seconds', () => powerMonitor.getSystemIdleTime());

  // Fire-and-forget push, not invoke/handle — this is the only signal the
  // main process needs about timer state that it can't get from powerMonitor
  // itself. The renderer is still the authoritative poller of
  // /device/time-entries/current; this just mirrors what it already knows.
  ipcMain.on('urlCapture:timerStateChanged', (_event, running: boolean) => {
    urlCaptureService?.setTimerRunning(running);
  });

  // A returning, already-logged-in user skips the login form (see
  // auth:status above) — start url-capture for them too, not just on a
  // fresh login.
  const existingSession = authStore.load();
  if (existingSession) {
    startUrlCapture(
      existingSession.deviceId,
      buildUrlSessionUploadFn(apiClient, authStore, existingSession.deviceToken),
    );
    startHeartbeat(apiClient, existingSession.deviceToken);
    startSync();
  }
  // No auto-download/install — this app isn't code-signed yet, and
  // electron-updater's silent update flow requires a valid signature on
  // macOS to work at all. So this just checks GitHub and lets the person
  // open the releases page themselves when there's something newer.
  ipcMain.handle(
    'update:status',
    (): Promise<UpdateCheckResult> => checkForUpdate(app.getVersion()),
  );

  ipcMain.handle('update:openReleasesPage', async (): Promise<void> => {
    await shell.openExternal(RELEASES_PAGE_URL);
  });
}

/**
 * Launcher overrides are written at app startup, not at timer start, so
 * every browser opened afterwards is tracked with no user step.
 *
 * Best-effort: an already-open browser keeps its empty tree until next
 * launched, and a failed write is logged rather than thrown — losing URL
 * capture must never stop time tracking.
 */
function activateBrowsersOnLinux(): void {
  if (process.platform !== 'linux') return;

  try {
    const report = applyBrowserActivation({ scope: 'user' });
    const activated = report.outcomes.filter((outcome) => outcome.activated);
    console.log(
      `[activation] ${activated.length}/${report.outcomes.length} browser launchers activated in ${report.targetDirectory}`,
    );
    for (const failed of report.outcomes.filter((outcome) => !outcome.activated)) {
      console.log(`[activation] could not activate ${failed.fileName}: ${failed.reason}`);
    }
  } catch (error) {
    console.log(`[activation] skipped: ${String(error)}`);
  }
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  void app.whenReady().then(() => {
    activateBrowsersOnLinux();
    registerIpcHandlers();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // Quitting must PAUSE the running timer, never stop or discard it — the
  // elapsed value has to survive to the next launch. The pause is a network
  // call, so the first quit is deferred until it settles and then re-issued.
  // `quitPauseComplete` makes that re-issue a plain quit instead of looping.
  app.on('before-quit', (event) => {
    if (!quitPauseComplete && pauseRunningTimer) {
      event.preventDefault();
      void pauseRunningTimer()
        .catch((error: unknown) => console.error('[timer] pause on quit failed:', error))
        .finally(() => {
          quitPauseComplete = true;
          stopUrlCapture();
          stopHeartbeat();
          stopSync();
          app.quit();
        });
      return;
    }
    stopUrlCapture();
    stopHeartbeat();
    stopSync();
  });

  // Suspend and shutdown get the same treatment. There is no way to hold
  // the OS back while an HTTP call completes, so this is best-effort: it
  // usually lands, and when it does not the entry simply stays running and
  // the next launch reconciles it. Never stop() here — that would end the
  // entry and lose the ability to resume it.
  const pauseForPowerEvent = (label: string): void => {
    void pauseRunningTimer?.().catch((error: unknown) =>
      console.error(`[timer] pause on ${label} failed:`, error),
    );
  };
  powerMonitor.on('suspend', () => pauseForPowerEvent('suspend'));
  powerMonitor.on('shutdown', () => pauseForPowerEvent('shutdown'));

  // Logging out, and most graceful shutdowns, send SIGTERM rather than
  // anything Electron reports as a quit — without this the process dies with
  // the timer still running. Routed through app.quit() so it takes the same
  // pause-then-exit path as closing the window.
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => app.quit());
  }
}
