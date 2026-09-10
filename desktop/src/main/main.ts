import { hostname as osHostname, release as osRelease } from 'node:os';
import { join } from 'node:path';
import { app, BrowserWindow, ipcMain, powerMonitor } from 'electron';
import type { TrackingResult } from './api-client';
import { ApiClient } from './api-client';
import { resolveApiBaseUrl } from './api-base-url';
import { AuthStore } from './auth-store';
import { getOrCreateDeviceFingerprint } from './device-identity';
import { toDevicePlatform } from './platform';
import { buildDarwinCoverageReport } from './resolvers/darwin/coverage';
import { resolveDarwinResolverPath } from './resolvers/darwin/resolver-path';
import { PermissionStateMachine } from './resolvers/darwin/permission-state';
import { buildWin32CoverageReport, detectInstalledWin32Browsers } from './resolvers/win32/coverage';
import { InstalledBrowserDetector as DarwinInstalledBrowserDetector } from './resolvers/darwin/installed-browsers';
import { resolveWinResolverPath } from './resolvers/win32/resolver-path';
import { loadBrowserRegistry } from './url-capture/browser-registry';
import type { CoverageReport } from './url-capture/coverage-report';
import { DebugHarness, NullDebugHarness, type DebugSink } from './url-capture/debug-harness';
import { ResolverHealthTracker } from './url-capture/resolver-health';
import type { ResolverSpawnConfig } from './url-capture/resolver-manager';
import { ResolverOrchestrator } from './url-capture/resolver-orchestrator';
import { UrlCaptureService } from './url-capture/url-capture-service';

/**
 * macOS and Windows only — Linux resolver support (Stage D) doesn't exist
 * yet. Returns null on any other platform so startUrlCapture degrades to
 * timer/idle tracking only, exactly like today's behavior everywhere,
 * rather than throwing or spawning nothing usable.
 */
function resolverSpawnConfigForPlatform(): ResolverSpawnConfig | null {
  if (process.platform === 'darwin') {
    return {
      command: process.execPath,
      args: [resolveDarwinResolverPath()],
      env: {
        // Runs the darwin resolver (a plain compiled JS file, not a
        // separately-built native binary) via Electron's own executable
        // acting as a plain Node process — avoids depending on a system
        // Node install existing on the user's machine.
        ELECTRON_RUN_AS_NODE: '1',
        // That same plain-Node-process consequence means the resolver
        // can't call app.isPackaged/process.resourcesPath itself to find
        // firefox-ax-helper (a separate native binary it spawns as its
        // own child) — see firefox-ax-helper-path.ts.
        RESOLVER_IS_PACKAGED: app.isPackaged ? '1' : '0',
        RESOLVER_RESOURCES_PATH: process.resourcesPath,
      },
    };
  }

  if (process.platform === 'win32') {
    return {
      command: resolveWinResolverPath({ isPackaged: app.isPackaged, resourcesPath: process.resourcesPath }),
    };
  }

  return null;
}

const NOT_LOGGED_IN: TrackingResult<never> = {
  ok: false,
  message: "You've been signed out — please log in to continue.",
};

const API_BASE_URL = resolveApiBaseUrl(app.isPackaged);

interface LoginCredentials {
  email: string;
  password: string;
}

interface AuthStatus {
  loggedIn: boolean;
  email?: string;
  message?: string;
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

// Well under the backend's DEVICE_HEARTBEAT_WINDOW_MINUTES (5 min default —
// see backend/src/devices/device-status.ts) so a normal 60s scheduling
// jitter or one missed beat never flips a genuinely-running device to
// "offline" on the Devices page.
const HEARTBEAT_INTERVAL_MS = 60_000;

// Without this, POST /devices/heartbeat is never called at all — Device.
// lastSeenAt is set once at login and never refreshed, so every device
// shows "active" for exactly 5 minutes after login and then permanently
// flips to "offline" regardless of whether the app is still running. Started
// on login (and for an already-logged-in user at launch) and stopped on
// logout/quit, mirroring startUrlCapture/stopUrlCapture's own lifecycle.
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

// macOS and Windows: a real resolver side-car feeds focus/URL events in.
// Linux (Stage D) has no resolver yet, and resolverSpawnConfigForPlatform
// returns null there — this degrades to the same timer/idle/lock/suspend-
// only tracking as before on any unsupported platform, never throwing.
function startUrlCapture(deviceId: string): void {
  urlCaptureService?.stop();
  resolverOrchestrator?.stop();

  urlCaptureService = new UrlCaptureService({
    deviceId,
    userDataDir: app.getPath('userData'),
    powerMonitor,
    logger: (line) => console.log(line),
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

// F.1 (Step 25): the coverage report the renderer's coverage screen
// fetches on demand — never includes a URL or any reading content, only
// browser install/status/confidence and resolver health (see
// ResolverHealthTracker's own doc comment).
async function getCoverageReport(): Promise<CoverageReport | null> {
  const registry = loadBrowserRegistry();
  const resolverHealth = resolverOrchestrator?.healthSnapshot() ?? new ResolverHealthTracker().snapshot();
  const now = Date.now();

  if (process.platform === 'darwin') {
    const installedKeys = await new DarwinInstalledBrowserDetector().detectInstalled(registry);
    // Darwin's actual per-browser Automation/Accessibility permission
    // state lives inside the spawned resolver process — the pinned wire
    // protocol has no message type to report it back to Electron yet, so
    // this is honestly "not yet determined" rather than a guess. A future
    // protocol addition (an unsolicited permission-state event) would
    // replace this with the resolver's real, live state.
    const permissions = new PermissionStateMachine().get();
    return buildDarwinCoverageReport({ installedKeys, registry, permissions, resolverHealth, now });
  }

  if (process.platform === 'win32') {
    const installedKeys = await detectInstalledWin32Browsers(registry);
    return buildWin32CoverageReport({ registry, installedKeys, resolverHealth, now });
  }

  return null; // Linux — no resolver, nothing to report yet
}

function stopUrlCapture(): void {
  resolverOrchestrator?.stop();
  resolverOrchestrator = null;
  urlCaptureService?.stop();
  urlCaptureService = null;
}

let coverageWindow: BrowserWindow | null = null;

// A separate small window rather than a view inside the main status
// window — keeps the existing view-switching flow (login/status)
// completely untouched, and this is an occasional diagnostic screen, not
// part of the everyday timer flow.
function openCoverageWindow(): void {
  if (coverageWindow) {
    coverageWindow.focus();
    return;
  }
  coverageWindow = new BrowserWindow({
    width: 480,
    height: 640,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  void coverageWindow.loadFile(join(__dirname, '../renderer/coverage.html'));
  coverageWindow.on('closed', () => {
    coverageWindow = null;
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 560,
    resizable: false,
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

  ipcMain.handle('auth:status', (): AuthStatus => {
    const session = authStore.load();
    return session ? { loggedIn: true, email: session.email } : { loggedIn: false };
  });

  ipcMain.handle(
    'auth:login',
    async (_event, credentials: LoginCredentials): Promise<AuthStatus> => {
      const fingerprint = getOrCreateDeviceFingerprint(app.getPath('userData'));
      const result = await apiClient.login({
        email: credentials.email,
        password: credentials.password,
        deviceFingerprint: fingerprint,
        platform: toDevicePlatform(process.platform),
        osVersion: osRelease(),
        hostname: osHostname(),
        appVersion: app.getVersion(),
      });

      if (!result.ok) {
        return { loggedIn: false, message: result.message };
      }

      authStore.save({
        email: credentials.email,
        deviceId: result.deviceId,
        deviceToken: result.deviceToken,
      });
      startUrlCapture(result.deviceId);
      startHeartbeat(apiClient, result.deviceToken);
      return { loggedIn: true, email: credentials.email };
    },
  );

  ipcMain.handle('auth:logout', async (): Promise<AuthStatus> => {
    const session = authStore.load();
    if (session) {
      await apiClient.logout(session.deviceToken);
      authStore.clear();
    }
    stopUrlCapture();
    stopHeartbeat();
    return { loggedIn: false };
  });

  /**
   * Every tracking:* call goes through this: if the backend responds
   * unauthorized (DeviceSessionGuard returns exactly this for a missing,
   * expired, or — the case this exists for — admin-revoked session), the
   * local session is cleared and url-capture/heartbeat stopped right away,
   * not left to linger until the user notices and tries to interact.
   * Without this, an admin's remote sign-out (Devices page) had no effect
   * on the desktop app at all until it happened to restart: the local
   * session file still had a token, so every subsequent poll kept
   * silently failing against a session the backend had already revoked.
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
    }
    return result;
  }

  ipcMain.handle('tracking:listProjects', () => callDeviceApi((token) => apiClient.listProjects(token)));

  ipcMain.handle('tracking:listTasks', (_event, projectId: string) =>
    callDeviceApi((token) => apiClient.listTasks(token, projectId)),
  );

  ipcMain.handle('tracking:start', (_event, projectId: string, taskId: string | null) =>
    callDeviceApi((token) => apiClient.startTimer(token, projectId, taskId)),
  );

  ipcMain.handle('tracking:switch', (_event, projectId: string, taskId: string | null) =>
    callDeviceApi((token) => apiClient.switchTimer(token, projectId, taskId)),
  );

  ipcMain.handle('tracking:stop', (_event, endedAt?: string) =>
    callDeviceApi((token) => apiClient.stopTimer(token, endedAt)),
  );

  ipcMain.handle('tracking:status', () => callDeviceApi((token) => apiClient.getCurrentTimer(token)));

  ipcMain.handle('tracking:pause', () => callDeviceApi((token) => apiClient.pauseTimer(token)));

  ipcMain.handle('tracking:resume', () => callDeviceApi((token) => apiClient.resumeTimer(token)));

  ipcMain.handle('tracking:idlePolicy', () =>
    callDeviceApi((token) => apiClient.getIdlePolicy(token)),
  );

  // Native, synchronous, and free of any network round-trip — the renderer
  // polls this on its own short interval while a timer is running.
  // See docs/adr/0007-... : unreliable under Wayland (X11 XScreenSaver
  // extension only), matching the desktop app's existing "Linux
  // best-effort" support level.
  ipcMain.handle('idle:seconds', () => powerMonitor.getSystemIdleTime());

  // F.1's coverage screen — invoked on demand (the screen's own refresh
  // button), not polled, since installed-browser detection spawns a real
  // OS query tool per platform and isn't cheap enough to run continuously.
  ipcMain.handle('coverage:get', () => getCoverageReport());
  ipcMain.on('coverage:openWindow', () => openCoverageWindow());

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
    startUrlCapture(existingSession.deviceId);
    startHeartbeat(apiClient, existingSession.deviceToken);
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

  app.on('before-quit', () => {
    stopUrlCapture();
    stopHeartbeat();
  });
}
