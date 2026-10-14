import { execFile } from "node:child_process";
import { hostname as osHostname, release as osRelease } from "node:os";
import { join, resolve } from "node:path";
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  powerMonitor,
  shell,
  systemPreferences,
  Tray,
} from "electron";
import type {
  AllowedApps,
  AppUrlTracking,
  PairingPollResult,
  TimeEntry,
  TrackingResult,
} from "./api-client";
import { ApiClient } from "./api-client";
import { resolveApiBaseUrl } from "./api-base-url";
import { ActivitySampler, SEGMENT_MS } from "./activity-sampler";
import { ActivitySampleUploader } from "./activity-sample-uploader";
import { AppEventUploader } from "./app-event-uploader";
import { AuthStore } from "./auth-store";
import { PendingTimerOps } from "./pending-timer-ops";
import { allowedAppsNotice } from "./allowed-apps-notice";
import { CaptureSettingsGate } from "./capture-settings-gate";
import { getOrCreateDeviceFingerprint } from "./device-identity";
import { registerAppImageSchemeHandler } from "./linux-scheme-handler";
import { shouldRemind } from "./tracking-reminder";
import type { ReminderSettings } from "./tracking-reminder";
import { X11WindowTracker } from "./x11-window-tracker";
import { GnomeIdleMonitor } from "./gnome-idle-monitor";
import { GnomeWindowFocusTracker } from "./gnome-window-focus-tracker";
import { OfflineQueue } from "./offline-queue";
import { OfflineQueueStore } from "./offline-queue-store";
import { isWaylandSession, toDevicePlatform } from "./platform";
import type { DesktopDevicePlatform } from "./platform";
import { captureScreenViaPortal } from "./screenshot-portal";
import {
  DEFAULT_SCREENSHOT_INTERVAL_MS,
  ScreenshotSampler,
} from "./screenshot-sampler";
import { ScreenshotUploader } from "./screenshot-uploader";
import { TimerStatusGate } from "./timer-status-gate";
import { loadActiveWindowModule, WindowSampler } from "./window-sampler";
import {
  resolveLinuxResolverPath,
  resolveDarwinResolverPath,
  resolveWinResolverPath,
} from "./resolvers/resolver-paths";
import { applyBrowserActivation } from "./resolvers/linux/browser-activation";
import {
  BrowserRestartService,
  type BlindBrowserReport,
} from "./resolvers/linux/browser-restart-service";
import {
  browserRestartPrompt,
  browsersOrphanedBySweep,
} from "./browser-restart-prompt";
import {
  type CloseAction,
  hasWaylandScreenshotGrant,
  markBrowserRestartPromptSeen,
  markWaylandScreenshotGranted,
  rememberCloseAction,
  cacheReminderSettings,
  cachedReminderSettings,
  rememberedCloseAction,
} from "./setup-state";
import type { BrowserRestartPrompt } from "../preload/preload";
import {
  ACCESSIBILITY_COPY,
  SETTINGS_DEEP_LINKS,
} from "./resolvers/darwin/permission-copy";
import { InstalledBrowserDetector } from "./resolvers/darwin/installed-browsers";
import type { SettingsPane } from "./resolvers/darwin/permission-copy";
import {
  DebugHarness,
  NullDebugHarness,
  type DebugSink,
} from "./url-capture/debug-harness";
import { intervalFromEnv } from "./tuning";
import type { ResolverSpawnConfig } from "./url-capture/resolver-manager";
import { ResolverOrchestrator } from "./url-capture/resolver-orchestrator";
import type { UploadFn } from "./url-capture/sync-contract";
import { UrlCaptureService } from "./url-capture/url-capture-service";

/**
 * All three platforms now have a resolver. Returns null only on a platform
 * with none, so startUrlCapture degrades to timer/idle tracking rather
 * than throwing or spawning nothing usable.
 */
function resolverSpawnConfigForPlatform(): ResolverSpawnConfig | null {
  if (process.platform === "darwin") {
    return {
      command: process.execPath,
      args: [resolveDarwinResolverPath()],
      env: {
        // The darwin resolver is compiled JS, not a native binary, so it runs
        // on Electron's own executable as a plain Node process — no system
        // Node required.
        ELECTRON_RUN_AS_NODE: "1",
        // Which also means it can't read app.isPackaged/resourcesPath itself
        // to locate firefox-ax-helper — see firefox-ax-helper-path.ts.
        RESOLVER_IS_PACKAGED: app.isPackaged ? "1" : "0",
        RESOLVER_RESOURCES_PATH: process.resourcesPath,
      },
    };
  }

  if (process.platform === "win32") {
    return {
      command: resolveWinResolverPath({
        isPackaged: app.isPackaged,
        resourcesPath: process.resourcesPath,
      }),
    };
  }

  if (process.platform === "linux") {
    return {
      command: process.execPath,
      args: [resolveLinuxResolverPath()],
      // Same trick as darwin. No resourcesPath hints needed: this one spawns
      // no child, talking to the accessibility bus directly over D-Bus.
      env: { ELECTRON_RUN_AS_NODE: "1" },
    };
  }

  return null;
}
import type { UpdateCheckResult } from "./update-checker";
import { RELEASES_PAGE_URL, checkForUpdate } from "./update-checker";
import { syncAutoLaunch } from "./auto-launch";
import type { AutoUpdateState } from "./auto-updater";
import {
  getAutoUpdateState,
  restartToApplyUpdate,
  startAutoUpdater,
} from "./auto-updater";
import {
  loadRelaunchHistory,
  recordRelaunch,
  shouldRelaunch,
} from "./crash-recovery";

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
  name?: string;
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

interface CapturePermissionStatus {
  windowTrackingEnabled: boolean;
  /** What "Track apps & URLs" resolves to — the banners ask only for
   * permissions something will actually use. */
  appUrlTracking: AppUrlTracking;
  screenshotsEnabled: boolean;
  platform: DesktopDevicePlatform;
  screenRecordingGranted: boolean;
  waylandUnsupported: boolean;
  /**
   * macOS + Firefox only: the AX helper needs Accessibility, while every other
   * browser uses Apple Events. Polled rather than read once at launch, since the
   * user can revoke it mid-session — which used to stop Firefox tracking with
   * nothing surfaced. `true` elsewhere so no other platform shows the banner.
   */
  accessibilityGranted: boolean;
  /**
   * Sent rather than duplicated: the renderer cannot import main-process modules
   * (tsconfig.renderer.json pins rootDir to src/renderer), and permission-copy.ts
   * is the single source for user-facing wording.
   */
  accessibilityGuidance: string;
}

// Otherwise userData resolves from package.json's "name" ("desktop"),
// producing a generic ~/.config/desktop directory — set explicitly now,
// before any installs exist, since changing it later orphans the stored
// fingerprint/session and makes every existing install re-register as a
// "new" device.
app.setName("Hi Day");

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
/**
 * Set once a real quit is under way. Until then the window's close button
 * hides it to the tray instead, so tracking keeps running — closing the
 * window used to quit the app (and pause the timer) on Windows and Linux.
 */
let isQuitting = false;

/** The tracker's two fixed sizes: the full window and the compact bar. */
const FULL_WINDOW_SIZE = { width: 360, height: 600 };
const COMPACT_WINDOW_SIZE = { width: 360, height: 72 };
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

/**
 * Catches whatever would otherwise crash the whole process silently and
 * relaunches into a fresh one instead of leaving the person with a
 * vanished app and no idea why. Safe by construction: everything this app
 * cares about surviving a crash (the session, the running timer, the
 * offline queue) already lives on disk or on the server, not in memory —
 * see AuthStore, OfflineQueueStore, and the pause-before-quit flow below —
 * so a relaunch picks all of it back up the same way a normal restart
 * does. `shouldRelaunch` guards against looping forever if the crash
 * itself happens on every single startup (a bad build, a corrupt local
 * file) rather than being a one-off.
 */
function handleFatalError(kind: string, error: unknown): void {
  console.error(`[fatal] unhandled ${kind}:`, error);

  const userDataDir = app.getPath("userData");
  const now = Date.now();
  if (!shouldRelaunch(loadRelaunchHistory(userDataDir), now)) {
    console.error(
      "[fatal] too many relaunches in the last minute — not retrying again.",
    );
    app.exit(1);
    return;
  }
  recordRelaunch(userDataDir, now);

  // Best-effort — there's no time left to await a network round-trip on the
  // way down, same reasoning as the suspend/shutdown handlers further down.
  void pauseRunningTimer?.().catch(() => {});
  app.relaunch();
  app.exit(1);
}

process.on("uncaughtException", (error) =>
  handleFatalError("exception", error),
);
process.on("unhandledRejection", (reason) =>
  handleFatalError("rejection", reason),
);

// Well under the backend's DEVICE_HEARTBEAT_WINDOW_MINUTES (5 min default —
// see backend/src/devices/device-status.ts) so a normal 60s scheduling
// jitter or one missed beat never flips a genuinely-running device to
// "offline" on the Devices page.
const HEARTBEAT_INTERVAL_MS = 60_000;

/** How long the "tracking stopped" popup is left alone before focusing the
 * window counts as having read it. */
const TRACKING_ALERT_DWELL_MS = 5_000;

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
const SYNC_INTERVAL_MS = intervalFromEnv("WM_SYNC_INTERVAL_MS", 30_000);

/**
 * The real network-backed `UploadFn` for a logged-in device. A 401 signs
 * out locally like callDeviceApi does, rather than leaving the queue
 * retrying against a revoked session.
 */
function buildUrlSessionUploadFn(
  apiClient: ApiClient,
  authStore: AuthStore,
  deviceToken: string,
  /** "Window titles" — off, page names are left out too, as it promises. */
  keepTitles: () => boolean,
): UploadFn {
  return async (batch) => {
    const result = await apiClient.syncUrlSessions(
      deviceToken,
      keepTitles() ? batch : batch.map((session) => ({ ...session, title: null })),
    );
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
          `${status === undefined ? " (server unreachable)" : ` (HTTP ${status})`}: ${result.message} — will retry.`,
      );
    }
    return { acked: [] };
  };
}

function startSync(): void {
  stopSync();
  syncTimer = setInterval(() => {
    urlCaptureService?.runSync().catch((error: unknown) => {
      // A failed sync is retried next tick; it must never reach the
      // unhandled-rejection handler, which relaunches the app.
      console.error("[url-capture] sync failed:", error);
    });
  }, SYNC_INTERVAL_MS);
}

function stopSync(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

// macOS, Windows and Linux each have a resolver side-car feeding focus/URL
// events in; anywhere else resolverSpawnConfigForPlatform returns null and
// this degrades to timer/idle-only tracking rather than throwing. Started
// only by `syncUrlCapture`, which owns the lifecycle.
function startUrlCapture(deviceId: string, upload: UploadFn): UrlCaptureService {
  urlCaptureService?.stop();
  resolverOrchestrator?.stop();

  urlCaptureService = new UrlCaptureService({
    deviceId,
    userDataDir: app.getPath("userData"),
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

  return urlCaptureService;
}

// Opt-in only (URL_TRACKING_CONTEXT.md's pinned rule: "never log a full
// URL at info level or above... the debug log is opt-in") — an env var
// rather than a persisted setting for now, since this is a
// developer/support diagnostic, not an end-user-facing preference.
// Writes raw+normalized readings to userData, never to the regular log.
function buildDebugSink(): DebugSink {
  if (process.env.HIDAY_DEBUG_URL_CAPTURE !== "1") {
    return new NullDebugHarness();
  }
  return new DebugHarness(
    join(app.getPath("userData"), "url-capture-debug.jsonl"),
  );
}

function stopUrlCapture(): void {
  resolverOrchestrator?.stop();
  resolverOrchestrator = null;
  urlCaptureService?.stop();
  urlCaptureService = null;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    ...FULL_WINDOW_SIZE,
    useContentSize: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    // The renderer draws its own title bar (drag region, minimise, close).
    frame: false,
    backgroundColor: "#f8f6f1",
    // Window/taskbar icon. Only Linux reads it — Windows and macOS take the
    // packaged app's icon (electron-builder.yml) — but setting it always
    // also gives `pnpm dev` the right icon instead of Electron's default.
    icon: join(__dirname, "assets/icon.png"),
    webPreferences: {
      preload: join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  mainWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    handleCloseRequest();
  });
  // Windows logoff/shutdown closes windows without a before-quit first;
  // hiding there would hold the session open.
  mainWindow.on("session-end", () => {
    isQuitting = true;
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function showMainWindow(): void {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

/**
 * The person opening Hi Day again from the tray, the dock or a second
 * launch. Closing only hides the window, so the renderer never reloads —
 * this tells it to re-read the day's time from the server instead.
 */
function reopenMainWindow(): void {
  const wasHidden = mainWindow !== null && !mainWindow.isVisible();
  showMainWindow();
  if (wasHidden) mainWindow?.webContents.send("window:reopened");
}

/**
 * Closing the window either hides it to the tray, where tracking carries
 * on, or quits — which stops the timer. The renderer asks which, in its own
 * styled prompt, until the person ticks "Remember my choice"; the tray menu
 * can undo that. Its answer comes back through `applyCloseAction`.
 */
function handleCloseRequest(): void {
  if (!mainWindow) return;
  const remembered = rememberedCloseAction(app.getPath("userData"));
  if (remembered) {
    applyCloseAction(remembered);
    return;
  }
  mainWindow.webContents.send("window:closeRequested");
}

function applyCloseAction(action: CloseAction): void {
  if (action === "quit") app.quit();
  else mainWindow?.hide();
}

/** Swaps between the full window and the always-on-top compact bar. */
function setCompactWindow(compact: boolean): void {
  if (!mainWindow) return;
  const size = compact ? COMPACT_WINDOW_SIZE : FULL_WINDOW_SIZE;
  // Some window managers ignore a programmatic resize on a non-resizable
  // window, so it is unlocked just for the resize.
  mainWindow.setResizable(true);
  mainWindow.setContentSize(size.width, size.height);
  mainWindow.setResizable(false);
  mainWindow.setAlwaysOnTop(compact, "floating");
}

/**
 * The way back to a window hidden by its close button. Not every Linux
 * desktop shows tray icons (stock GNOME needs the AppIndicator extension);
 * there, launching Hi Day again brings the window back via second-instance.
 */
function createTray(): void {
  const iconSize = process.platform === "win32" ? 16 : 22;
  const image = nativeImage
    .createFromPath(join(__dirname, "assets/icon.png"))
    .resize({ width: iconSize, height: iconSize });
  tray = new Tray(image);
  tray.setToolTip("Hi Day");
  refreshTrayMenu();
  tray.on("click", reopenMainWindow);
}

function refreshTrayMenu(): void {
  if (!tray) return;
  const remembered = rememberedCloseAction(app.getPath("userData")) !== null;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open Hi Day", click: reopenMainWindow },
      // The only way back from a remembered close choice short of wiping
      // the app's data — without it, a remembered "Quit" is permanent.
      ...(remembered
        ? [
            {
              label: "Ask Before Closing Again",
              click: () => {
                rememberCloseAction(app.getPath("userData"), null);
                refreshTrayMenu();
              },
            },
          ]
        : []),
      { type: "separator" },
      { label: "Quit Hi Day", click: () => app.quit() },
    ]),
  );
}

async function registerIpcHandlers(): Promise<void> {
  const authStore = new AuthStore(app.getPath("userData"));
  // Remembered once Spotlight gives an answer (it takes a few hundred ms,
  // and the banner asks every 15s). A lookup that fails — Spotlight busy at
  // login, or indexing off — isn't remembered, and counts as installed, so
  // the banner errs towards asking rather than hiding.
  let firefoxInstalled: boolean | null = null;
  const isFirefoxInstalled = async (): Promise<boolean> => {
    if (firefoxInstalled === null) {
      firefoxInstalled = await new InstalledBrowserDetector().lookup(
        "org.mozilla.firefox",
      );
    }
    return firefoxInstalled ?? true;
  };
  const isWaylandScreenshotGranted = (): boolean => {
    const userDataDir = app.getPath("userData");
    if (hasWaylandScreenshotGrant(userDataDir)) return true;
    // A grant an older version kept in the session moves to setup-state the
    // first time it's seen, so the next sign-out doesn't take it along.
    if (authStore.load()?.waylandScreenshotGranted === true) {
      markWaylandScreenshotGranted(userDataDir);
      return true;
    }
    return false;
  };
  const pendingOps = new PendingTimerOps(app.getPath("userData"));
  const apiClient = new ApiClient(API_BASE_URL);

  // The offline queue (docs/TECH_DESIGN.md §4): every app-event and
  // screenshot is persisted to SQLite before it's sent, and drained in
  // batches on a periodic, jittered tick — a dropped connection holds data
  // rather than losing it, and a failed batch retries with backoff instead
  // of being dropped. One queue instance serves both capture kinds.
  const offlineQueueStore = await OfflineQueueStore.create(
    join(app.getPath("userData"), "offline-queue.db"),
  );
  const offlineQueue = new OfflineQueue(offlineQueueStore);

  const appEventUploader = new AppEventUploader(
    authStore,
    apiClient,
    offlineQueue,
  );
  offlineQueue.registerSender(appEventUploader);

  // Fills WindowSampler's Wayland gap via AT-SPI2 (see docs/adr/0016-...) —
  // started unconditionally at app startup, independent of login/timer
  // state, same as the other capture-adjacent infrastructure here: it's a
  // passive listener with negligible cost while idle, and WindowSampler
  // itself already gates on windowTrackingEnabled && timerRunning before
  // ever consulting it. Linux-only — the accessibility bus this depends on
  // doesn't exist on macOS/Windows.
  const gnomeWindowFocusTracker =
    process.platform === "linux"
      ? new GnomeWindowFocusTracker({ logger: (line) => console.log(line) })
      : null;
  void gnomeWindowFocusTracker?.start();

  // Read before AT-SPI: X11 sees every XWayland client, including the
  // applications that publish no accessibility tree at all (PyCharm and
  // other JetBrains IDEs among them). Linux-only, and harmless where there
  // is no X display — it simply reports nothing and AT-SPI answers instead.
  const x11WindowTracker =
    process.platform === "linux"
      ? new X11WindowTracker({ logger: (line) => console.log(line) })
      : null;
  void x11WindowTracker?.start();
  // Linux-only, best-effort — see gnome-idle-monitor.ts.
  const gnomeIdleMonitor =
    process.platform === "linux"
      ? new GnomeIdleMonitor({ logger: (line) => console.log(line) })
      : null;

  // Declared up here, not with the other capture state below, because the
  // sink closes over it.
  let windowTrackingEnabled = false;

  const windowSampler = new WindowSampler({
    // "Window titles" decides only whether the title rides along; whether
    // apps are sampled at all is `appUrlTracking`'s call.
    sink: (sample) =>
      appEventUploader.enqueue(
        windowTrackingEnabled ? sample : { ...sample, title: null },
      ),
    getX11Focus: () => x11WindowTracker?.getLastFocus() ?? null,
    getGnomeFocus: () => gnomeWindowFocusTracker?.getLastFocus() ?? null,
  });

  const activitySampleUploader = new ActivitySampleUploader(
    authStore,
    apiClient,
    offlineQueue,
  );
  offlineQueue.registerSender(activitySampleUploader);

  // Reads idle rather than hooking input: a segment counts as active when
  // the last input landed inside it. Same reading the idle banner uses, so
  // activity needs no native input hook (see docs/adr/0013-...).
  const readIdleSeconds = async (): Promise<number> => {
    const gnomeMs = await gnomeIdleMonitor?.getIdleMilliseconds();
    if (gnomeMs !== null && gnomeMs !== undefined) {
      return Math.floor(gnomeMs / 1000);
    }
    return powerMonitor.getSystemIdleTime();
  };
  const activitySampler = new ActivitySampler(activitySampleUploader.enqueue, {
    readIdleSeconds,
  });
  let activityTicker: ReturnType<typeof setInterval> | null = null;

  const screenshotUploader = new ScreenshotUploader(
    authStore,
    apiClient,
    offlineQueue,
  );
  offlineQueue.registerSender(screenshotUploader);
  const screenshotSampler = new ScreenshotSampler({
    sink: screenshotUploader.upload,
    isWaylandScreenshotGranted,
  });

  offlineQueue.start();

  // Window tracking and screenshot capture each only run while BOTH are
  // true: the org has that capture's setting on, AND a timer is actually
  // running right now (Hubstaff-style — not merely "logged in"). All
  // signals are independently polled (server is authoritative for each —
  // settings can change from the web console, and the timer can be
  // started/stopped from the web console or another device, see
  // docs/adr/0006-...), and any one flipping recomputes both.
  let appUrlTracking: AppUrlTracking = "off";
  let allowedApps: AllowedApps = "all";
  /** Held so it can be withdrawn once read — see `dismissTrackingAlert`. */
  let trackingNotification: Notification | null = null;
  let trackingAlertDwell: ReturnType<typeof setTimeout> | null = null;
  let screenshotsEnabled = false;
  let screenshotFrequencyMs = DEFAULT_SCREENSHOT_INTERVAL_MS;
  let timerRunning = false;
  function recomputeSampling(): void {
    if (appUrlTracking !== "off" && timerRunning) {
      windowSampler.start();
    } else {
      windowSampler.stop();
      // Push out whatever's buffered immediately rather than waiting up to
      // DEFAULT_APP_EVENT_FLUSH_INTERVAL_MS — tracking just turned off, so
      // there's no reason to sit on a partial batch.
      void appEventUploader.flush();
    }

    // Rides neither capture setting: activity is not an app, a URL or a
    // window title, so switching those off must not blank it out.
    if (timerRunning) {
      activityTicker ??= setInterval(() => void activitySampler.tick(), SEGMENT_MS);
    } else if (activityTicker) {
      clearInterval(activityTicker);
      activityTicker = null;
      // Emit the part-finished period rather than discarding the minutes
      // already measured, then push it out with the rest.
      void activitySampler.flush().then(() => activitySampleUploader.flush());
    }

    screenshotSampler.setIntervalMs(screenshotFrequencyMs);
    if (screenshotsEnabled && timerRunning) {
      screenshotSampler.start();
    } else {
      screenshotSampler.stop();
    }

    syncUrlCapture();
  }

  /**
   * URL capture's lifecycle is owned here rather than by the login
   * handlers, so that flipping "Track apps & URLs" takes effect on the
   * gate's next poll instead of only at the next sign-in. The service
   * handles timer state itself (`setTimerRunning`), so this decides only
   * whether it exists at all.
   */
  function syncUrlCapture(): void {
    const session = authStore.load();
    const wanted = appUrlTracking === "apps_urls" && session !== null;

    if (!wanted) {
      stopUrlCapture();
      return;
    }
    if (urlCaptureService) return;

    const service = startUrlCapture(
      session.deviceId,
      buildUrlSessionUploadFn(
        apiClient,
        authStore,
        session.deviceToken,
        () => windowTrackingEnabled,
      ),
    );
    // Seeded, or a timer already running would go uncaptured until the
    // renderer next pushed a state change.
    service.setTimerRunning(timerRunning);
  }

  /**
   * The server has already ended the running entry by this point, so
   * someone left looking at a stopped timer behind other windows would
   * carry on working believing it still ran — hence the push to the front
   * as well as the banner.
   */
  function announceAllowedApps(next: AllowedApps): void {
    if (next === allowedApps) return;
    const notice = allowedAppsNotice(next);
    mainWindow?.webContents.send("tracking:notice", notice);
    if (notice) alertTrackingStopped(notice);
    else dismissTrackingAlert();
  }

  /** The desktop's notification shelf is what carries the unread badge on
   * our icon, so a read alert has to be taken back out of it. */
  function dismissTrackingAlert(): void {
    if (trackingAlertDwell) clearTimeout(trackingAlertDwell);
    trackingAlertDwell = null;
    mainWindow?.flashFrame(false);
    trackingNotification?.close();
    trackingNotification = null;
  }

  /**
   * Three escalating attempts, because a window manager is free to refuse
   * any of them: a desktop notification, which survives even when the app
   * may not take focus (the normal case on Linux, where focus-stealing
   * prevention ignores `focus()` from a background process); a brief
   * always-on-top pass, which is what actually raises the window when a
   * plain `show()` is ignored; and a flashing taskbar entry as the last
   * resort, cleared once the window is actually looked at.
   */
  /**
   * A brief always-on-top pass, which is what actually raises the window
   * when a plain `show()` is ignored, and a flashing taskbar entry as the
   * last resort — a window manager is free to refuse either.
   */
  function raiseWindowInsistently(): void {
    showMainWindow();
    if (!mainWindow) return;

    mainWindow.setAlwaysOnTop(true);
    mainWindow.setAlwaysOnTop(false);
    mainWindow.flashFrame(true);

    // Deferred: raising the window above fires `focus` itself, and
    // dismissing in the same tick made the popup flash and vanish.
    if (trackingAlertDwell) clearTimeout(trackingAlertDwell);
    trackingAlertDwell = setTimeout(() => {
      trackingAlertDwell = null;
      mainWindow?.once("focus", dismissTrackingAlert);
    }, TRACKING_ALERT_DWELL_MS);
  }

  function alertTrackingStopped(body: string): void {
    if (Notification.isSupported()) {
      // Replaces rather than stacks: two of these say the same thing.
      trackingNotification?.close();
      trackingNotification = new Notification({
        title: "Time tracking stopped",
        body,
      });
      trackingNotification.show();
    }

    raiseWindowInsistently();
  }

  /** Ticks far more often than the interval, so a reminder lands close to
   * the minute it is due rather than up to an interval late. */
  const REMINDER_TICK_MS = 30_000;
  let reminderSettings: ReminderSettings | null | undefined = null;
  /** When this untracked stretch last got attention: the app starting, a
   * timer stopping, or the last reminder. */
  let untrackedSince = new Date();

  function describeLateness(minutes: number): string {
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    const hoursPart = `${hours} hour${hours === 1 ? "" : "s"}`;
    return rest === 0 ? hoursPart : `${hoursPart} ${rest} min`;
  }

  function deliverReminder(
    delivery: string,
    untrackedMinutes: number,
    signedOut: boolean,
  ): void {
    const how = describeLateness(untrackedMinutes);
    const body = signedOut
      ? `Open Hi Day and log in to start tracking — ${how} untracked.`
      : `You have not started tracking — ${how} untracked.`;

    if (delivery === "alert") {
      // The modal is the interruption; raising is only what puts it in
      // front of the person.
      mainWindow?.webContents.send("tracking:reminder", body);
      raiseWindowInsistently();
      return;
    }

    if (!Notification.isSupported()) return;
    // Never steals focus, but still opens the app when clicked — a
    // reminder nobody can act on is no reminder at all.
    trackingNotification?.close();
    trackingNotification = new Notification({
      title: "Not tracking time",
      body,
    });
    trackingNotification.on("click", showMainWindow);
    trackingNotification.show();
  }

  async function reminderTick(): Promise<void> {
    // Signed out the poll reports nothing, so the last settings this
    // machine saw stand in — that is the morning someone needs telling.
    const signedOut = authStore.load() === null;
    const settings = signedOut
      ? cachedReminderSettings(app.getPath("userData"))
      : reminderSettings;

    const now = new Date();
    const due = shouldRemind({
      settings,
      now,
      isTracking: signedOut ? false : timerRunning,
      idleSeconds: await readIdleSeconds(),
      since: untrackedSince,
    });
    if (!due || !settings) return;

    const untrackedMinutes = Math.round(
      (now.getTime() - untrackedSince.getTime()) / 60_000,
    );
    untrackedSince = now;
    deliverReminder(settings.delivery, untrackedMinutes, signedOut);
  }

  const captureSettingsGate = new CaptureSettingsGate(
    authStore,
    apiClient,
    (settings) => {
      windowTrackingEnabled = settings.windowTrackingEnabled;
      appUrlTracking = settings.appUrlTracking;
      announceAllowedApps(settings.allowedApps);
      allowedApps = settings.allowedApps;
      screenshotsEnabled = settings.screenshotsEnabled;
      screenshotFrequencyMs = settings.screenshotFrequencySeconds * 1000;
      reminderSettings = settings.reminders;
      // Only while signed in: the gate reports an all-off object with no
      // session, and caching that would erase the settings this is for.
      if (authStore.load() !== null) {
        cacheReminderSettings(app.getPath("userData"), settings.reminders);
      }
      recomputeSampling();
    },
  );
  const timerStatusGate = new TimerStatusGate(
    authStore,
    apiClient,
    (running) => {
      timerRunning = running;
      // Restart the reminder clock on any change, so stopping for lunch
      // buys a full interval of quiet rather than a nudge seconds later.
      untrackedSince = new Date();
      // URL capture's own copy too: a service created while the server was
      // unreachable started out "stopped", and the renderer only pushes on
      // a change it saw itself — so this is what brings it back.
      urlCaptureService?.setTimerRunning(running);
      recomputeSampling();
    },
  );
  captureSettingsGate.start();
  timerStatusGate.start();
  setInterval(() => void reminderTick(), REMINDER_TICK_MS);

  // Set once a pairing request is started, cleared once it's claimed or
  // expires — the renderer's poll doesn't need to pass the code back on
  // every call, matching how it already doesn't pass the device token
  // back for tracking calls.
  let pendingPairingCode: string | null = null;

  /** The renderer asking for attention: a dialog behind other windows is
   * one nobody reads. Same escalation as the capture-settings alert. */
  ipcMain.handle("tracking:alert", (_event, body: string): void => {
    alertTrackingStopped(typeof body === "string" ? body : "");
  });

  ipcMain.handle("auth:status", (): AuthStatus => {
    const session = authStore.load();
    return session
      ? {
          loggedIn: true,
          email: session.email,
          name: session.name,
          organisationName: session.organisationName,
        }
      : { loggedIn: false };
  });

  ipcMain.handle(
    "auth:startPairing",
    async (): Promise<StartPairingIpcResult> => {
      const fingerprint = getOrCreateDeviceFingerprint(app.getPath("userData"));
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

  ipcMain.handle("auth:pairingStatus", async (): Promise<PairingPollResult> => {
    if (!pendingPairingCode) {
      return { status: "expired" };
    }

    const result = await apiClient.pollPairing(pendingPairingCode);

    if (result.status === "approved") {
      pendingPairingCode = null;
      authStore.save({
        email: result.email,
        name: result.name,
        organisationName: result.organisationName,
        deviceId: result.deviceId,
        deviceToken: result.deviceToken,
      });
      // Approval is the new "just logged in" moment — the password
      // handler these hung off no longer exists.
      startHeartbeat(apiClient, result.deviceToken);
      startSync();
      // Re-check both gates immediately rather than waiting for their own
      // poll intervals — a device that was logged out (and therefore not
      // tracking) should pick this up as soon as it's logged back in,
      // including resuming a timer that was already running server-side.
      // This also starts url-capture, which `recomputeSampling` owns now
      // that it depends on a setting.
      void captureSettingsGate.pollOnce();
      void timerStatusGate.pollOnce();
    } else if (result.status === "expired") {
      pendingPairingCode = null;
    }

    return result;
  });

  ipcMain.handle("auth:logout", async (): Promise<AuthStatus> => {
    const session = authStore.load();
    if (session) {
      // Pause BEFORE revoking the session — afterwards the token is dead
      // and the running entry could never be paused, leaving it to run
      // unattended until the next login noticed it.
      await pendingOps.pause(session.deviceToken, apiClient);
      await apiClient.logout(session.deviceToken);
      authStore.clear();
    }
    stopUrlCapture();
    stopHeartbeat();
    stopSync();
    // No session left to poll against — both gates resolve to "off",
    // which stops the sampler if it was running.
    void captureSettingsGate.pollOnce();
    void timerStatusGate.pollOnce();
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
    if (result.ok) {
      // Keeps the offline-pause fallback supplied with the live entry.
      const data = result.data as
        | { entry?: TimeEntry | null; startedAt?: string; endedAt?: string | null }
        | null;
      if (data && "entry" in data) pendingOps.remember(data.entry ?? null);
      else if (data?.startedAt && !data.endedAt) {
        pendingOps.remember(data as TimeEntry);
      }
    }
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
    await pendingOps.pause(session.deviceToken, apiClient);
  };

  // Offline pauses/starts are only real to the server once this lands, so
  // reading the timer settles them first.
  const flushPendingOps = async (): Promise<void> => {
    const session = authStore.load();
    if (!session) return;
    if (await pendingOps.flush(session.deviceToken, apiClient)) {
      void timerStatusGate.pollOnce();
    }
  };
  setInterval(() => void flushPendingOps().catch(() => {}), 15_000);

  ipcMain.handle("tracking:listProjects", () =>
    callDeviceApi((token) => apiClient.listProjects(token)),
  );

  ipcMain.handle("tracking:listTasks", (_event, projectId: string) =>
    callDeviceApi((token) => apiClient.listTasks(token, projectId)),
  );

  // Remembering the Project on the way through means the renderer never has
  // to manage it: whatever the timer last actually started against is what a
  // later play resumes to.
  ipcMain.handle(
    "tracking:start",
    async (
      _event,
      projectId: string,
      taskId: string | null,
      startedAt?: string,
    ) => {
      const result = await callDeviceApi((token) =>
        pendingOps.start(token, projectId, taskId, apiClient, startedAt),
      );
      if (result.ok) authStore.rememberProject(projectId, taskId);
      // Instant local feedback for window tracking rather than waiting on
      // TimerStatusGate's poll; the periodic poll still covers a timer
      // started or stopped elsewhere.
      void timerStatusGate.pollOnce();
      return result;
    },
  );

  ipcMain.handle(
    "tracking:switch",
    async (_event, projectId: string, taskId: string | null) => {
      const result = await callDeviceApi((token) =>
        pendingOps.switchTo(token, projectId, taskId, apiClient),
      );
      if (result.ok) authStore.rememberProject(projectId, taskId);
      void timerStatusGate.pollOnce();
      return result;
    },
  );

  ipcMain.handle("tracking:lastProject", (): LastProject | null => {
    const session = authStore.load();
    if (!session?.lastProjectId) return null;
    return {
      projectId: session.lastProjectId,
      taskId: session.lastTaskId ?? null,
    };
  });

  ipcMain.handle("tracking:stop", async (_event, endedAt?: string) => {
    await flushPendingOps();
    const result = await callDeviceApi((token) =>
      apiClient.stopTimer(token, endedAt),
    );
    void timerStatusGate.pollOnce();
    return result;
  });

  ipcMain.handle("tracking:status", async () => {
    await flushPendingOps();
    return callDeviceApi((token) => apiClient.getCurrentTimer(token));
  });

  ipcMain.handle("tracking:pause", async () => {
    const result = await callDeviceApi((token) =>
      pendingOps.pause(token, apiClient),
    );
    // Instant local feedback rather than waiting on TimerStatusGate's poll —
    // capture must stop as soon as the person pauses, not up to 15s later.
    void timerStatusGate.pollOnce();
    return result;
  });

  ipcMain.handle("tracking:resume", async () => {
    const result = await callDeviceApi((token) => apiClient.resumeTimer(token));
    void timerStatusGate.pollOnce();
    return result;
  });

  ipcMain.handle(
    "tracking:entriesBetween",
    (_event, from: string, to: string) =>
      callDeviceApi((token) => apiClient.listEntriesBetween(token, from, to)),
  );

  ipcMain.handle("tracking:idlePolicy", () =>
    callDeviceApi((token) => apiClient.getIdlePolicy(token)),
  );

  ipcMain.handle(
    "tracking:permissionStatus",
    async (): Promise<TrackingResult<CapturePermissionStatus>> => {
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
          appUrlTracking,
          screenshotsEnabled,
          platform,
          // Non-prompting status check — never triggers a native prompt on
          // its own (unlike @paymoapp/active-window's `requestPermissions()`
          // or the portal's own `interactive: true` call, both of which must
          // only ever fire from an explicit "Grant Access" click below).
          // macOS reads the real OS permission; Linux/Wayland reads our own
          // record of the one-time portal grant (see
          // setup-state's markWaylandScreenshotGranted) since the portal
          // itself has no query-only "check without asking" API the way
          // macOS's getMediaAccessStatus does.
          screenRecordingGranted:
            platform === "macos"
              ? systemPreferences.getMediaAccessStatus("screen") === "granted"
              : platform === "linux" && isWaylandSession()
                ? isWaylandScreenshotGranted()
                : true,
          waylandUnsupported: isWaylandSession(),
          // Non-prompting, like the check above: `false` means "tell me", never
          // "ask the user". Only Firefox needs Accessibility, so without it
          // installed there's nothing to ask for.
          accessibilityGranted:
            platform === "macos"
              ? systemPreferences.isTrustedAccessibilityClient(false) ||
                !(await isFirefoxInstalled())
              : true,
          accessibilityGuidance: ACCESSIBILITY_COPY.deniedGuidance,
        },
      };
    },
  );

  // Triggers the native macOS Screen Recording prompt, or (on Linux/Wayland)
  // the portal's one-time interactive Screenshot grant — never called
  // except from this handler, itself only ever invoked by an explicit
  // "Grant Access" click in the renderer. Neither platform re-shows its own
  // prompt on a later silent call, so this must never fire automatically
  // (e.g. on launch) — see screenshot-portal.ts and ScreenshotSampler's
  // `isWaylandScreenshotGranted` gate.
  ipcMain.handle(
    "tracking:requestScreenRecordingAccess",
    async (): Promise<void> => {
      if (process.platform === "darwin") {
        loadActiveWindowModule()?.requestPermissions();
        return;
      }
      if (process.platform === "linux" && isWaylandSession()) {
        const buffer = await captureScreenViaPortal(true);
        if (!buffer) return;
        markWaylandScreenshotGranted(app.getPath("userData"));
        // The grant call itself already captured a real screenshot —
        // upload it instead of discarding it, same shape as any other
        // tick's sample.
        screenshotUploader.upload({
          buffer,
          capturedAt: new Date().toISOString(),
        });
      }
    },
  );

  // Fallback for when macOS won't re-show the native prompt (already
  // asked/denied before) — opens the Screen Recording pane directly so the
  // person can grant it themselves.
  // One handler for every privacy pane. Accessibility has no native prompt the
  // way Automation does, so opening System Settings is all the app can offer —
  // and the screen-recording banner needs the same thing, differing only in
  // which pane. Links come from permission-copy.ts rather than being repeated.
  ipcMain.handle(
    "tracking:openPrivacySettings",
    async (_event, pane: SettingsPane): Promise<void> => {
      if (process.platform === "darwin") {
        await shell.openExternal(SETTINGS_DEEP_LINKS[pane]);
      }
    },
  );

  // Prefers GNOME's D-Bus reading — powerMonitor only works under X11.
  ipcMain.handle("idle:seconds", async () => {
    const gnomeMs = await gnomeIdleMonitor?.getIdleMilliseconds();
    if (gnomeMs !== null && gnomeMs !== undefined) {
      return Math.floor(gnomeMs / 1000);
    }
    return powerMonitor.getSystemIdleTime();
  });

  // Fire-and-forget push, not invoke/handle — this is the only signal the
  // main process needs about timer state that it can't get from powerMonitor
  // itself. The renderer is still the authoritative poller of
  // /device/time-entries/current; this just mirrors what it already knows.
  ipcMain.on("urlCapture:timerStateChanged", (_event, running: boolean) => {
    urlCaptureService?.setTimerRunning(running);
  });

  // A returning, already-logged-in user skips the login form (see
  // auth:status above) — they need the heartbeat and sync loop too, not
  // just a fresh login. Url-capture comes from the settings gate's own
  // first poll, which `captureSettingsGate.start()` already fired.
  const existingSession = authStore.load();
  if (existingSession) {
    startHeartbeat(apiClient, existingSession.deviceToken);
    startSync();
  }
  // Manual fallback: on a platform startAutoUpdater can't silently update
  // (macOS is unsigned — see auto-updater.ts) this just checks GitHub and
  // lets the person open the releases page themselves when there's
  // something newer. Also covers a transient auto-update failure on
  // win/linux, since the renderer falls back to this whenever
  // update:autoStatus isn't reporting an active download.
  ipcMain.handle(
    "update:status",
    (): Promise<UpdateCheckResult> => checkForUpdate(app.getVersion()),
  );

  ipcMain.handle("update:openReleasesPage", async (): Promise<void> => {
    await shell.openExternal(RELEASES_PAGE_URL);
  });

  ipcMain.handle(
    "update:autoStatus",
    (): AutoUpdateState => getAutoUpdateState(),
  );

  ipcMain.handle("update:restart", (): void => {
    isQuitting = true;
    restartToApplyUpdate();
  });

  ipcMain.handle("window:minimise", (): void => {
    mainWindow?.minimize();
  });

  // The idle prompt needs an answer even if the window was closed to the tray.
  ipcMain.handle("window:show", (): void => {
    showMainWindow();
  });

  ipcMain.handle("window:close", (): void => {
    handleCloseRequest();
  });

  ipcMain.handle(
    "window:answerClose",
    (_event, action: unknown, remember: unknown): void => {
      if (action !== "minimize" && action !== "quit") return; // cancelled
      if (remember === true) {
        rememberCloseAction(app.getPath("userData"), action);
        refreshTrayMenu();
      }
      applyCloseAction(action);
    },
  );

  ipcMain.handle("window:setCompact", (_event, compact: boolean): void => {
    setCompactWindow(compact);
  });

  ipcMain.handle(
    "setup:browserRestartPrompt",
    (): BrowserRestartPrompt =>
      browserRestartPrompt({
        platform: process.platform,
        userDataDir: app.getPath("userData"),
        findBrowsers: () => browsersOpenBeforeActivation,
        log: (line) => console.log(line),
      }),
  );

  ipcMain.handle("setup:continueFromBrowserRestart", async (): Promise<void> => {
    // Recorded before the restart, not after: the person has given their
    // answer, and a browser that refuses to die must not buy them the same
    // screen again on the next launch.
    markBrowserRestartPromptSeen(app.getPath("userData"));
    if (process.platform !== "linux") return;

    const service = new BrowserRestartService({
      logger: (line) => console.log(line),
    });
    // Exactly what the screen named, not the live set: a browser opened since
    // this launch started from the activated entry and has its launcher
    // binding, so restarting it would cost its tabs and fix nothing. One
    // closed in the meantime has no process left to signal, and `restart`
    // skips it rather than opening it on the person's behalf.
    await service.restart(browsersOpenBeforeActivation.restartable);
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
/**
 * The browsers that were open when this launch shadowed the launchers,
 * captured before the sweep writes anything.
 *
 * The first-run screen offers exactly these. Re-reading the live set when
 * Continue is pressed would also catch browsers opened since, which started
 * from the activated entry — already tracked, already bound to their
 * launcher, and so with nothing but their tabs to lose from a restart.
 */
let browsersOpenBeforeActivation: BlindBrowserReport = {
  restartable: [],
  manual: [],
  warnings: [],
};

function activateBrowsersOnLinux(): void {
  if (process.platform !== "linux") return;

  // Read before the sweep, and in a try of its own: the moment an override
  // lands, every window these processes own has lost its launcher binding,
  // and nothing started after that point is one of the orphans. Kept separate
  // because a scan that throws must cost the restart screen and nothing more
  // — folding it in with the sweep below would let a failed /proc read stop
  // the overrides being written at all, which is URL capture itself.
  let openBeforeSweep: BlindBrowserReport = {
    restartable: [],
    manual: [],
    warnings: [],
  };
  try {
    openBeforeSweep = new BrowserRestartService({
      logger: (line) => console.log(line),
    }).findRunning();
  } catch (error) {
    console.log(`[activation] could not list open browsers: ${String(error)}`);
  }

  try {
    const report = applyBrowserActivation({ scope: "user" });

    // A created override — rather than an unchanged or rewritten one — is
    // what a fresh install looks like, since uninstall takes them with it.
    // The browsers open right now have just been orphaned and have never
    // been offered the restart that reseats them, whatever a previous
    // install on this machine recorded. Every later launch leaves the set
    // empty, which is what holds the screen to one appearance.
    browsersOpenBeforeActivation = browsersOrphanedBySweep(
      openBeforeSweep,
      report.outcomes,
    );
    const activated = report.outcomes.filter((outcome) => outcome.activated);
    console.log(
      `[activation] ${activated.length}/${report.outcomes.length} browser launchers activated in ${report.targetDirectory}`,
    );
    for (const failed of report.outcomes.filter(
      (outcome) => !outcome.activated,
    )) {
      console.log(
        `[activation] could not activate ${failed.fileName}: ${failed.reason}`,
      );
    }
  } catch (error) {
    console.log(`[activation] skipped: ${String(error)}`);
  }
}

/** What the web console's "Open Hi Day" button navigates to once a device
 * is linked. The app is already running by then, so the link's job is
 * raising its window. */
const DEEP_LINK_SCHEME = "hiday";

/**
 * Covers Windows, whose registry entries nothing else writes — macOS and
 * Linux are registered at package time by electron-builder's `protocols:`.
 * Unpackaged, Electron is the registered binary rather than Hi Day, so the
 * script path goes too or the launch resolves to a bare Electron.
 */
function registerDeepLinkScheme(): void {
  if (!app.isPackaged) {
    const entryScript = process.argv[1];
    if (entryScript === undefined) return;
    app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME, process.execPath, [
      resolve(entryScript),
    ]);
    return;
  }

  app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME);

  // Best-effort and deliberately swallowed: this runs before the window
  // and every capture loop, so a read-only home directory or a missing
  // update-desktop-database must cost the person a deep link, never their
  // tracking.
  try {
    const directory = registerAppImageSchemeHandler(DEEP_LINK_SCHEME);
    if (directory === null) return;
    // Without re-indexing, the entry sits there unread until something
    // else happens to rebuild the cache.
    execFile("update-desktop-database", [directory], (error) => {
      if (error) console.log(`[deep-link] re-index skipped: ${error.message}`);
    });
  } catch (error) {
    console.log(`[deep-link] registration skipped: ${String(error)}`);
  }
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  // A deep link reaches Windows and Linux as a fresh launch, which this
  // already turns into "raise the window we have".
  app.on("second-instance", reopenMainWindow);
  // macOS delivers it to the running instance, possibly before ready.
  app.on("open-url", (event) => {
    event.preventDefault();
    if (app.isReady()) reopenMainWindow();
  });

  void app.whenReady().then(async () => {
    activateBrowsersOnLinux();
    syncAutoLaunch();
    await registerIpcHandlers();
    createWindow();
    createTray();
    startAutoUpdater((line) => console.log(line));
    // Last, and never awaited: claiming a URL scheme is the least
    // important thing this app does, and nothing above it should wait on
    // or be reachable by it.
    registerDeepLinkScheme();

    app.on("activate", reopenMainWindow);
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  // A renderer crash (OOM, a GPU crash, a native module segfaulting inside
  // it) kills the window but never touches this process's own state — the
  // offline queue, url-capture, and the capture-settings/timer-status gates
  // all keep running in the main process throughout. Recreating the window
  // is enough to recover visibly; nothing here needs replaying. Excludes
  // 'clean-exit', which covers an intentional close (e.g. window.destroy()
  // during before-quit), not a crash.
  app.on("render-process-gone", (_event, _webContents, details) => {
    console.error(
      `[renderer] gone: ${details.reason} (exit code ${details.exitCode})`,
    );
    if (details.reason === "clean-exit") return;
    mainWindow?.destroy();
    mainWindow = null;
    createWindow();
  });

  // GPU/utility process crashes — Electron already recovers the GPU process
  // on its own; this is here purely so a crash there shows up in the logs
  // instead of vanishing silently.
  app.on("child-process-gone", (_event, details) => {
    console.error(`[child-process] gone: ${details.type} ${details.reason}`);
  });

  // Quitting ends the running timer rather than leaving it open. Pausing is
  // what does that now — an entry is one unbroken span, so pause closes it —
  // and the elapsed time survives in the finished entry rather than in an
  // entry still open at midnight for the day-boundary split to carve up.
  // The call is over the network, so the first quit is deferred until it
  // settles and then re-issued; `quitPauseComplete` makes that re-issue a
  // plain quit instead of looping.
  app.on("before-quit", (event) => {
    isQuitting = true;
    if (!quitPauseComplete && pauseRunningTimer) {
      event.preventDefault();
      void pauseRunningTimer()
        .catch((error: unknown) =>
          console.error("[timer] pause on quit failed:", error),
        )
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
  powerMonitor.on("suspend", () => pauseForPowerEvent("suspend"));
  powerMonitor.on("shutdown", () => {
    isQuitting = true;
    pauseForPowerEvent("shutdown");
  });

  // Logging out, and most graceful shutdowns, send SIGTERM rather than
  // anything Electron reports as a quit — without this the process dies with
  // the timer still running. Routed through app.quit() so it takes the same
  // pause-then-exit path as closing the window.
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => app.quit());
  }
}
