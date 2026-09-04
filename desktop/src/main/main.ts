import { hostname as osHostname, release as osRelease } from 'node:os';
import { join } from 'node:path';
import { app, BrowserWindow, ipcMain, powerMonitor } from 'electron';
import type { TrackingResult } from './api-client';
import { ApiClient } from './api-client';
import { AuthStore } from './auth-store';
import { getOrCreateDeviceFingerprint } from './device-identity';
import { toDevicePlatform } from './platform';

const NOT_LOGGED_IN: TrackingResult<never> = {
  ok: false,
  message: "You've been signed out — please log in to continue.",
};

const API_BASE_URL = process.env.DESKTOP_API_URL ?? 'http://localhost:3001';

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
      return { loggedIn: true, email: credentials.email };
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
