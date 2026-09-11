import { hostname as osHostname, release as osRelease } from 'node:os';
import { join } from 'node:path';
import { app, BrowserWindow, ipcMain, powerMonitor, shell } from 'electron';
import type { PairingPollResult, TrackingResult } from './api-client';
import { ApiClient } from './api-client';
import { resolveApiBaseUrl } from './api-base-url';
import { AuthStore } from './auth-store';
import { getOrCreateDeviceFingerprint } from './device-identity';
import { toDevicePlatform } from './platform';

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
    (_event, projectId: string, taskId: string | null) =>
      withSignOutDetection(authStore, (token) =>
        apiClient.startTimer(token, projectId, taskId),
      ),
  );

  ipcMain.handle(
    'tracking:switch',
    (_event, projectId: string, taskId: string | null) =>
      withSignOutDetection(authStore, (token) =>
        apiClient.switchTimer(token, projectId, taskId),
      ),
  );

  ipcMain.handle('tracking:stop', (_event, endedAt?: string) =>
    withSignOutDetection(authStore, (token) => apiClient.stopTimer(token, endedAt)),
  );

  ipcMain.handle('tracking:status', () =>
    withSignOutDetection(authStore, (token) => apiClient.getCurrentTimer(token)),
  );

  ipcMain.handle('tracking:idlePolicy', () =>
    withSignOutDetection(authStore, (token) => apiClient.getIdlePolicy(token)),
  );

  // Native, synchronous, and free of any network round-trip — the renderer
  // polls this on its own short interval while a timer is running.
  // See docs/adr/0007-... : unreliable under Wayland (X11 XScreenSaver
  // extension only), matching the desktop app's existing "Linux
  // best-effort" support level.
  ipcMain.handle('idle:seconds', () => powerMonitor.getSystemIdleTime());
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
