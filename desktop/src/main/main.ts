import { hostname as osHostname, release as osRelease } from 'node:os';
import { join } from 'node:path';
import {
  app,
  BrowserWindow,
  ipcMain,
  powerMonitor,
  shell,
  systemPreferences,
} from 'electron';
import ActiveWindow from '@paymoapp/active-window';
import type { PairingPollResult, TrackingResult } from './api-client';
import { ApiClient } from './api-client';
import { resolveApiBaseUrl } from './api-base-url';
import { AppEventUploader } from './app-event-uploader';
import { AuthStore } from './auth-store';
import { CaptureSettingsGate } from './capture-settings-gate';
import { getOrCreateDeviceFingerprint } from './device-identity';
import { isWaylandSession, toDevicePlatform } from './platform';
import type { DesktopDevicePlatform } from './platform';
import { TimerStatusGate } from './timer-status-gate';
import { WindowSampler } from './window-sampler';
import type { UpdateCheckResult } from './update-checker';
import { RELEASES_PAGE_URL, checkForUpdate } from './update-checker';

const NOT_LOGGED_IN: TrackingResult<never> = {
  ok: false,
  message: "You've been signed out — please log in to continue.",
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

interface CapturePermissionStatus {
  windowTrackingEnabled: boolean;
  platform: DesktopDevicePlatform;
  screenRecordingGranted: boolean;
  waylandUnsupported: boolean;
}

// Otherwise userData resolves from package.json's "name" ("desktop"),
// producing a generic ~/.config/desktop directory — set explicitly now,
// before any installs exist, since changing it later orphans the stored
// fingerprint/session and makes every existing install re-register as a
// "new" device.
app.setName('Workforce Monitor');

let mainWindow: BrowserWindow | null = null;

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

/**
 * Runs an authenticated tracking call and, if the backend reports the
 * device session itself is gone (a 401, not just a transient failure —
 * see ApiClient's `signedOut`), clears the stored session so the *next*
 * `auth:status` check — and this response's own `signedOut` flag, which
 * the renderer acts on immediately — reflect being logged out. This is
 * how logging out from the web app (ADR-0009) reaches the desktop: there's
 * no push channel, so it's discovered the next time this device happens
 * to call the backend, same as the renderer's existing 15s status poll.
 */
async function withSignOutDetection<T>(
  authStore: AuthStore,
  run: (deviceToken: string) => Promise<TrackingResult<T>>,
): Promise<TrackingResult<T>> {
  const session = authStore.load();
  if (!session) {
    return NOT_LOGGED_IN;
  }

  const result = await run(session.deviceToken);
  if (!result.ok && result.signedOut) {
    authStore.clear();
  }
  return result;
}

function registerIpcHandlers(): void {
  const authStore = new AuthStore(app.getPath('userData'));
  const apiClient = new ApiClient(API_BASE_URL);
  const appEventUploader = new AppEventUploader(authStore, apiClient);
  appEventUploader.start();
  const windowSampler = new WindowSampler({ sink: appEventUploader.enqueue });

  // Window tracking only runs while BOTH are true: the org has the setting
  // on, AND a timer is actually running right now (Hubstaff-style — not
  // merely "logged in"). Each signal is independently polled (server is
  // authoritative for both — the setting can change from the web console,
  // and the timer can be started/stopped from the web console or another
  // device, see docs/adr/0006-...), and either one flipping recomputes
  // whether the sampler should be running.
  let windowTrackingEnabled = false;
  let timerRunning = false;
  function recomputeSampling(): void {
    if (windowTrackingEnabled && timerRunning) {
      windowSampler.start();
    } else {
      windowSampler.stop();
      // Push out whatever's buffered immediately rather than waiting up to
      // DEFAULT_APP_EVENT_FLUSH_INTERVAL_MS — tracking just turned off, so
      // there's no reason to sit on a partial batch.
      void appEventUploader.flush();
    }
  }

  const captureSettingsGate = new CaptureSettingsGate(authStore, apiClient, (enabled) => {
    windowTrackingEnabled = enabled;
    recomputeSampling();
  });
  const timerStatusGate = new TimerStatusGate(authStore, apiClient, (running) => {
    timerRunning = running;
    recomputeSampling();
  });
  captureSettingsGate.start();
  timerStatusGate.start();

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
        // Re-check both gates immediately rather than waiting for their own
        // poll intervals — a device that was logged out (and therefore not
        // tracking) should pick this up as soon as it's logged back in,
        // including resuming a timer that was already running server-side.
        void captureSettingsGate.pollOnce();
        void timerStatusGate.pollOnce();
      } else if (result.status === 'expired') {
        pendingPairingCode = null;
      }

      return result;
    },
  );

  ipcMain.handle('auth:logout', async (): Promise<AuthStatus> => {
    const session = authStore.load();
    if (session) {
      await apiClient.logout(session.deviceToken);
      authStore.clear();
    }
    // No session left to poll against — both gates resolve to "off",
    // which stops the sampler if it was running.
    void captureSettingsGate.pollOnce();
    void timerStatusGate.pollOnce();
    return { loggedIn: false };
  });

  ipcMain.handle('tracking:listProjects', () =>
    withSignOutDetection(authStore, (token) => apiClient.listProjects(token)),
  );

  ipcMain.handle('tracking:listTasks', (_event, projectId: string) =>
    withSignOutDetection(authStore, (token) =>
      apiClient.listTasks(token, projectId),
    ),
  );

  ipcMain.handle(
    'tracking:start',
    async (_event, projectId: string, taskId: string | null) => {
      const result = await withSignOutDetection(authStore, (token) =>
        apiClient.startTimer(token, projectId, taskId),
      );
      // Instant local feedback for window tracking, rather than waiting on
      // TimerStatusGate's own poll interval — the periodic poll still
      // covers a timer started/stopped elsewhere (web console, another
      // device).
      void timerStatusGate.pollOnce();
      return result;
    },
  );

  ipcMain.handle(
    'tracking:switch',
    async (_event, projectId: string, taskId: string | null) => {
      const result = await withSignOutDetection(authStore, (token) =>
        apiClient.switchTimer(token, projectId, taskId),
      );
      void timerStatusGate.pollOnce();
      return result;
    },
  );

  ipcMain.handle('tracking:stop', async (_event, endedAt?: string) => {
    const result = await withSignOutDetection(authStore, (token) =>
      apiClient.stopTimer(token, endedAt),
    );
    void timerStatusGate.pollOnce();
    return result;
  });

  ipcMain.handle('tracking:status', () =>
    withSignOutDetection(authStore, (token) => apiClient.getCurrentTimer(token)),
  );

  ipcMain.handle('tracking:idlePolicy', () =>
    withSignOutDetection(authStore, (token) => apiClient.getIdlePolicy(token)),
  );

  ipcMain.handle(
    'tracking:permissionStatus',
    (): TrackingResult<CapturePermissionStatus> => {
      const session = authStore.load();
      if (!session) return NOT_LOGGED_IN;

      // Reads the value CaptureSettingsGate already polls and keeps current
      // (see recomputeSampling above) rather than issuing a second, redundant
      // GET /device/capture-settings on every renderer status check.
      const platform = toDevicePlatform(process.platform);

      return {
        ok: true,
        data: {
          windowTrackingEnabled,
          platform,
          // Non-prompting status check (Electron's own API), not
          // @paymoapp/active-window's `requestPermissions()` — that one
          // triggers macOS's native Screen Recording prompt on first call,
          // which must only ever fire from an explicit "Grant Access"
          // click below, never from a status poll like this one.
          screenRecordingGranted:
            platform === 'macos'
              ? systemPreferences.getMediaAccessStatus('screen') === 'granted'
              : true,
          waylandUnsupported: isWaylandSession(),
        },
      };
    },
  );

  // Triggers the native macOS Screen Recording prompt — never called
  // except from this handler, itself only ever invoked by an explicit
  // "Grant Access" click in the renderer. macOS won't re-show the prompt
  // on repeat silent calls, so this must never be called automatically
  // (e.g. on launch).
  ipcMain.handle('tracking:requestScreenRecordingAccess', (): void => {
    if (process.platform === 'darwin') {
      ActiveWindow.requestPermissions();
    }
  });

  // Fallback for when macOS won't re-show the native prompt (already
  // asked/denied before) — opens the Screen Recording pane directly so the
  // person can grant it themselves.
  ipcMain.handle(
    'tracking:openScreenRecordingSettings',
    async (): Promise<void> => {
      if (process.platform === 'darwin') {
        await shell.openExternal(
          'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
        );
      }
    },
  );

  // Native, synchronous, and free of any network round-trip — the renderer
  // polls this on its own short interval while a timer is running.
  // See docs/adr/0007-... : unreliable under Wayland (X11 XScreenSaver
  // extension only), matching the desktop app's existing "Linux
  // best-effort" support level.
  ipcMain.handle('idle:seconds', () => powerMonitor.getSystemIdleTime());

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
}
