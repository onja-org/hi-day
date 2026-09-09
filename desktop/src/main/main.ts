import { hostname as osHostname, release as osRelease } from 'node:os';
import { join } from 'node:path';
import { app, BrowserWindow, ipcMain, powerMonitor } from 'electron';
import type { TrackingResult } from './api-client';
import { ApiClient } from './api-client';
import { resolveApiBaseUrl } from './api-base-url';
import { AuthStore } from './auth-store';
import { getOrCreateDeviceFingerprint } from './device-identity';
import { toDevicePlatform } from './platform';
import { UrlCaptureService } from './url-capture/url-capture-service';

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

// Not wired to a real focus/URL resolver yet — see UrlCaptureService's own
// doc comment for why. Today this only exercises timer/idle/lock/suspend
// flowing into the session engine and being persisted locally.
function startUrlCapture(deviceId: string): void {
  urlCaptureService?.stop();
  urlCaptureService = new UrlCaptureService({
    deviceId,
    userDataDir: app.getPath('userData'),
    powerMonitor,
    logger: (line) => console.log(line),
  });
  urlCaptureService.start();
}

function stopUrlCapture(): void {
  urlCaptureService?.stop();
  urlCaptureService = null;
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
    return { loggedIn: false };
  });

  ipcMain.handle('tracking:listProjects', () => {
    const session = authStore.load();
    return session ? apiClient.listProjects(session.deviceToken) : NOT_LOGGED_IN;
  });

  ipcMain.handle('tracking:listTasks', (_event, projectId: string) => {
    const session = authStore.load();
    return session
      ? apiClient.listTasks(session.deviceToken, projectId)
      : NOT_LOGGED_IN;
  });

  ipcMain.handle(
    'tracking:start',
    (_event, projectId: string, taskId: string | null) => {
      const session = authStore.load();
      return session
        ? apiClient.startTimer(session.deviceToken, projectId, taskId)
        : NOT_LOGGED_IN;
    },
  );

  ipcMain.handle(
    'tracking:switch',
    (_event, projectId: string, taskId: string | null) => {
      const session = authStore.load();
      return session
        ? apiClient.switchTimer(session.deviceToken, projectId, taskId)
        : NOT_LOGGED_IN;
    },
  );

  ipcMain.handle('tracking:stop', (_event, endedAt?: string) => {
    const session = authStore.load();
    return session
      ? apiClient.stopTimer(session.deviceToken, endedAt)
      : NOT_LOGGED_IN;
  });

  ipcMain.handle('tracking:status', () => {
    const session = authStore.load();
    return session
      ? apiClient.getCurrentTimer(session.deviceToken)
      : NOT_LOGGED_IN;
  });

  ipcMain.handle('tracking:idlePolicy', () => {
    const session = authStore.load();
    return session
      ? apiClient.getIdlePolicy(session.deviceToken)
      : NOT_LOGGED_IN;
  });

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
    startUrlCapture(existingSession.deviceId);
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
  });
}
