import { execFile } from "node:child_process";
import { hostname as osHostname, release as osRelease } from "node:os";
import { join, resolve } from "node:path";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  powerMonitor,
  screen,
  shell,
  systemPreferences,
  Tray,
} from "electron";
import type {
  AllowedApps,
  AppUrlTracking,
  CurrentTimer,
  HeartbeatCaptureReport,
  PairingPollResult,
  TimeEntry,
  TrackingResult,
} from "./api-client";
import { ApiClient, isTransportFailure } from "./api-client";
import { resolveApiBaseUrl } from "./api-base-url";
import { ActivitySampler, SEGMENT_MS } from "./activity-sampler";
import { ActivitySampleUploader } from "./activity-sample-uploader";
import { AppEventUploader } from "./app-event-uploader";
import { AuthStore, recentProjectIds } from "./auth-store";
import { PendingTimerOps } from "./pending-timer-ops";
import { OfflineCache } from "./offline-cache";
import { keepActionFor, recoveryActionFor } from "./recovered-timer";
import { BACKLOG_MESSAGE, shouldWarnAboutBacklog } from "./sync-backlog";

/** A timer the app came back to find still running after a crash. */
interface RecoveredTimer {
  startedAt: string;
  lastSeenAt: string;
  silentForMs: number;
  /** Carried so tracking can be continued on the same work — see `keepActionFor`. */
  projectId: string | null;
  taskId: string | null;
}
import { allowedAppsNotice } from "./allowed-apps-notice";
import { CaptureSettingsGate } from "./capture-settings-gate";
import { getOrCreateDeviceFingerprint } from "./device-identity";
import { recordingIndicatorFor } from "./recording-indicator";
import { registerAppImageSchemeHandler } from "./linux-scheme-handler";
import { hasTrackedFullWorkDay, shouldRemind } from "./tracking-reminder";
import type { ReminderSettings } from "./tracking-reminder";
import { X11WindowTracker } from "./x11-window-tracker";
import { assessAppCapture, describeDisplaySession } from "./app-capture-health";
import { assessUrlCapture } from "./url-capture-health";
import { displayName } from "./resolvers/linux/blind-browsers";
import { readSessionEnvironment } from "./resolvers/linux/support-gate";
import { GnomeIdleMonitor } from "./gnome-idle-monitor";
import { IdleHoldStore, whenInputStopped, type IdleHold } from "./idle-hold-store";
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
  markWaylandScreenshotGranted,
  rememberCloseAction,
  cacheReminderSettings,
  cachedWebAppUrl,
  compactAlwaysOnTop,
  rememberWebAppUrl,
  setCompactAlwaysOnTop,
  cachedReminderSettings,
  rememberedCloseAction,
  autoStartTimer as autoStartTimerEnabled,
  setAutoStartTimer,
  lastAutoStartedBoot,
  rememberAutoStartedBoot,
} from "./setup-state";
import { bootIdentity, decideAutoStart } from "./auto-start";
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
import { intervalFromEnv, offlineSimulated } from "./tuning";
import { resolveWebAppUrl } from "./web-app-url";
import { pinLevel, shouldPin } from "./window-pinning";
import type { WindowMode } from "./window-pinning";
import {
  identifyBrowser,
  loadBrowserRegistry,
  type RegistryPlatform,
} from "./url-capture/browser-registry";
import type { Source } from "./url-capture/protocol";
import type { ResolverSpawnConfig } from "./url-capture/resolver-manager";
import { ResolverOrchestrator } from "./url-capture/resolver-orchestrator";
import { syncWithOlderBackendFallback } from "./url-capture/older-backend-fallback";
import type { SyncResponseBody, UploadFn } from "./url-capture/sync-contract";
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
  checkForUpdatesNow,
  getAutoUpdateState,
  restartToApplyUpdate,
  startAutoUpdater,
  supportsSilentAutoUpdate,
} from "./auto-updater";
import { manualUpdateOutcome, updateDialogFor } from "./update-check-dialog";
import { recentProjectsFor, trayMenuTemplate } from "./tray-menu";
import type { TrayMenuState, TraySession } from "./tray-menu";
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

// A dev run gets its own userData, so it never competes with an installed
// build for the single-instance lock. Without this, `pnpm dev` loses the
// lock to the packaged app autostarted at login and merely raises that
// window — which looks exactly like the dev build failing to start.
if (!app.isPackaged) {
  app.setPath("userData", join(app.getPath("appData"), "Hi Day (dev)"));
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
/**
 * Set once a real quit is under way. Until then the window's close button
 * hides it to the tray instead, so tracking keeps running — closing the
 * window used to quit the app (and pause the timer) on Windows and Linux.
 */
/**
 * The least time the quitting dialog stays up. Long enough to read as
 * intentional; short enough that an ordinary quit still feels immediate.
 */
const QUIT_PROGRESS_MIN_VISIBLE_MS = 450;

/**
 * The most time quitting will spend emptying the queue. Five seconds is
 * already a long pause when you expected the app to go at once, and a
 * big backlog will not finish inside it — which costs nothing, since
 * queued records go up on the next launch.
 */
const QUIT_DRAIN_LIMIT_MS = intervalFromEnv('WM_QUIT_DRAIN_LIMIT_MS', 5_000);
/** The gate's copy lives in `registerIpcHandlers`; the menu needs its own. */
let trayTimerRunning = false;
/** Asks the renderer to do what pressing its own play/stop button does. */
let toggleTimerFromTray: (() => void) | null = null;
/** Asks the renderer to do what clicking a Project row does. */
let trackProjectFromTray: ((projectId: string) => void) | null = null;
/** Asks the renderer to do what its own Log out button does. */
let signOutFromTray: (() => void) | null = null;
/**
 * The session and cached Projects the menu shows, both of which live
 * inside `registerIpcHandlers`. Null until it has run: the menu then
 * reads as signed out.
 */
let trayAccount:
  | (() => {
      session: TraySession | null;
      recentProjects: { id: string; name: string }[];
    })
  | null = null;

let isQuitting = false;
/**
 * Set when the machine is going down rather than the person leaving. A
 * dialog is worse than useless there: nobody is looking, the OS will not
 * wait for it, and holding the quit open risks being killed mid-write —
 * which is precisely what writing the stop down first exists to avoid.
 */
let quittingForPowerEvent = false;
/** Assigned once the IPC handlers exist; see `drainBeforeQuit`. */
let drainBeforeQuit: (() => Promise<void>) | null = null;
/** Puts something on screen the instant Quit is pressed. */
let beginQuitProgress: (() => void) | null = null;

/** The tracker's two fixed sizes: the full window and the compact bar. */
const FULL_WINDOW_SIZE = { width: 360, height: 600 };
const COMPACT_WINDOW_SIZE = { width: 360, height: 72 };
const MINI_WINDOW_SIZE = { width: 68, height: 68 };

let urlCaptureService: UrlCaptureService | null = null;
let resolverOrchestrator: ResolverOrchestrator | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let syncTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Set once IPC handlers are registered, so the app-lifecycle hooks below
 * (which are wired outside that function) can pause the running timer.
 */
let pauseRunningTimer: (() => Promise<void>) | null = null;
/** Set once IPC handlers are registered, like `pauseRunningTimer`: what suspend and wake do with a running timer. */
let holdRunningTimerForSleep: (() => void) | null = null;
let markIdleReturnedOnWake: (() => void) | null = null;
/** The latest idle reading, for working out when input stopped as the machine sleeps. */
const IDLE_SAMPLE_INTERVAL_MS = 10_000;
let lastIdleReading: { seconds: number; atMs: number } | null = null;
/** Set alongside the window trackers, which live inside registerIpcHandlers. */
let readCaptureReport: (() => HeartbeatCaptureReport) | null = null;
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
    void apiClient.heartbeat(
      deviceToken,
      app.getVersion(),
      readCaptureReport?.() ?? undefined,
    );
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
    // The last failed response, for the handling below once the fallback
    // (an older backend rejecting unknown-URL sessions) has had its go.
    let failure: Exclude<TrackingResult<SyncResponseBody>, { ok: true }> | null = null;
    const attempt = await syncWithOlderBackendFallback(batch, async (sessions) => {
      const response = await apiClient.syncUrlSessions(
        deviceToken,
        keepTitles() ? sessions : sessions.map((session) => ({ ...session, title: null })),
      );
      if (response.ok) return { ok: true, acked: response.data.acked };
      failure = response;
      return { ok: false, status: response.status };
    });
    if (attempt.ok) {
      return { acked: attempt.acked };
    }
    // Cast because TypeScript can't see the assignment inside the callback.
    const result = failure as Exclude<TrackingResult<SyncResponseBody>, { ok: true }> | null;
    if (!result) return { acked: [] };

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
      ...unreadableBrowserOptions(),
    });
    resolverOrchestrator.start();
  } else {
    resolverOrchestrator = null;
  }

  return urlCaptureService;
}

/** Browsers running without their accessibility tree right now, by display name. */
function findBlindBrowserNames(): string[] {
  try {
    const report = new BrowserRestartService().findBlind();
    const names = [
      ...report.restartable.map((browser) => browser.command),
      ...report.manual.map((entry) => entry.browser.command),
    ].map(displayName);
    return [...new Set(names)];
  } catch {
    return []; // A /proc read that fails says nothing either way.
  }
}

/**
 * Lets a browser window whose URL cannot be read count as "URL unknown"
 * instead of vanishing — a Linux browser opened without its accessibility
 * tree, typically from a web-app shortcut, is the case that prompted it.
 */
function unreadableBrowserOptions(): {
  identifyBrowser?: (app: string) => string | null;
  platformSource?: Source;
} {
  const platform = process.platform;
  if (platform !== "linux" && platform !== "darwin" && platform !== "win32") {
    return {};
  }
  const registry = loadBrowserRegistry();
  const sources: Record<RegistryPlatform, Source> = {
    linux: "atspi",
    darwin: "apple-events",
    win32: "uia",
  };
  return {
    identifyBrowser: (appName) => identifyBrowser(registry, platform, appName),
    platformSource: sources[platform],
  };
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
    // Lets the smallest view be a rounded square with nothing behind
    // its corners; every other view paints its own background.
    transparent: true,
    backgroundColor: "#00000000",
    // A shadow is drawn round the window box, not the rounded square
    // inside it, which would ring the smallest view in grey.
    hasShadow: false,
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

/**
 * `focus()` is refused from a process that does not own the foreground —
 * the tray-click case — leaving the window restored but behind
 * everything; an always-on-top pass is what actually raises it. Restores
 * whatever pinning was in force, since the smaller bars pin on purpose.
 */
function forceToFront(): void {
  if (!mainWindow) return;
  const pinned = mainWindow.isAlwaysOnTop();
  mainWindow.setAlwaysOnTop(true, pinLevel(process.platform));
  mainWindow.moveTop();
  if (!pinned) mainWindow.setAlwaysOnTop(false);
  mainWindow.focus();
}

function showMainWindow(): void {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  forceToFront();
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

const WINDOW_SIZES = {
  full: FULL_WINDOW_SIZE,
  compact: COMPACT_WINDOW_SIZE,
  mini: MINI_WINDOW_SIZE,
} as const;

let windowMode: WindowMode = "full";

/** `setContentSize` keeps the top-left fixed, so shrinking must put the
 * widget back where they had it, not where the big window sat. */
let smallViewPosition: { x: number; y: number } | null = null;

function clampToDisplay(x: number, y: number, width: number, height: number) {
  const area = screen.getDisplayMatching({ x, y, width, height }).workArea;
  return {
    x: Math.round(
      Math.min(Math.max(x, area.x), Math.max(area.x, area.x + area.width - width)),
    ),
    y: Math.round(
      Math.min(Math.max(y, area.y), Math.max(area.y, area.y + area.height - height)),
    ),
  };
}

function setWindowMode(mode: WindowMode, centre = false): void {
  const leavingSmallView = windowMode !== "full" && mode === "full";
  if (leavingSmallView && mainWindow) {
    const [x, y] = mainWindow.getPosition();
    smallViewPosition = { x, y };
  }

  windowMode = mode;
  if (!mainWindow) return;
  const size = WINDOW_SIZES[mode];
  // Some window managers ignore a programmatic resize on a non-resizable
  // window, so it is unlocked just for the resize.
  mainWindow.setResizable(true);
  mainWindow.setContentSize(size.width, size.height);
  mainWindow.setResizable(false);
  positionForMode(mode, centre);
  // A resize can leave a platform repainting the creation colour behind
  // the page, framing the rounded square in chalk.
  mainWindow.setBackgroundColor(mode === "mini" ? "#00000000" : "#f8f6f1");
  applyPinning();
}

function positionForMode(mode: WindowMode, centre: boolean): void {
  if (!mainWindow) return;
  const [x, y] = mainWindow.getPosition();
  const { width, height } = mainWindow.getBounds();

  if (mode === "full" && centre) {
    // Centred on the display the widget was on, not the primary one.
    const area = screen.getDisplayMatching({ x, y, width, height }).workArea;
    const placed = clampToDisplay(
      area.x + Math.round((area.width - width) / 2),
      area.y + Math.round((area.height - height) / 2),
      width,
      height,
    );
    mainWindow.setPosition(placed.x, placed.y);
    return;
  }

  if (mode !== "full" && smallViewPosition) {
    const placed = clampToDisplay(
      smallViewPosition.x,
      smallViewPosition.y,
      width,
      height,
    );
    mainWindow.setPosition(placed.x, placed.y);
  }
}

/** See `shouldPin`: both small views follow one preference. */
function applyPinning(): void {
  if (!mainWindow) return;
  mainWindow.setAlwaysOnTop(
    shouldPin(windowMode, compactAlwaysOnTop(app.getPath("userData"))),
    pinLevel(process.platform),
  );
}

/**
 * The way back to a window hidden by its close button. Not every Linux
 * desktop shows tray icons (stock GNOME needs the AppIndicator extension);
 * there, launching Hi Day again brings the window back via second-instance.
 */
function createTray(): void {
  const iconSize = process.platform === "win32" ? 16 : 22;
  const image = nativeImage
    .createFromPath(join(__dirname, "assets/icon-idle.png"))
    .resize({ width: iconSize, height: iconSize });
  tray = new Tray(image);
  tray.setToolTip("Hi Day");
  refreshTrayMenu();
  tray.on("click", reopenMainWindow);
  // Whatever was decided before this existed — see
  // `recordingIndicatorState`. Not the idle image above, which is only
  // the placeholder this is built from.
  applyRecordingIndicator(recordingIndicatorState);
}

/** Best-effort: an icon that will not load must never take the app
 * down with it. */
/**
 * What the indicator was last told, so a tray that does not exist yet can
 * catch up. The gates are primed inside `registerIpcHandlers`, awaited
 * two lines before `createTray`, so a relaunch onto a running timer
 * announced it to a null `tray` and the tray was then built idle.
 */
let recordingIndicatorState = false;

function applyRecordingIndicator(isRecording: boolean): void {
  recordingIndicatorState = isRecording;
  const indicator = recordingIndicatorFor(process.platform, isRecording);
  const load = (file: string) =>
    nativeImage.createFromPath(join(__dirname, "assets", file));

  try {
    if (tray) {
      const size = process.platform === "win32" ? 16 : 22;
      tray.setImage(
        load(indicator.trayIcon).resize({ width: size, height: size }),
      );
      tray.setToolTip(indicator.tooltip);
    }
    if (mainWindow && process.platform === "win32") {
      mainWindow.setOverlayIcon(
        indicator.overlayIcon
          ? load(indicator.overlayIcon).resize({ width: 16, height: 16 })
          : null,
        indicator.tooltip,
      );
    }
    if (process.platform === "darwin") app.dock?.setBadge(indicator.dockBadge);
  } catch (error) {
    console.log(`[recording-indicator] skipped: ${String(error)}`);
  }
}

/**
 * What the menu was last built from. Some callers run on every status
 * poll, and rebuilding an unchanged menu can snap an open one shut under
 * AppIndicator.
 */
let lastTrayMenuState: string | null = null;

function refreshTrayMenu(): void {
  if (!tray) return;
  const userDataDir = app.getPath("userData");
  const pinned = compactAlwaysOnTop(userDataDir);
  const account = trayAccount?.() ?? { session: null, recentProjects: [] };
  const state: TrayMenuState = {
    session: account.session,
    timerRunning: trayTimerRunning,
    recentProjects: account.recentProjects,
    webAppUrl: resolveWebAppUrl(app.isPackaged, cachedWebAppUrl(userDataDir)),
    compactAlwaysOnTop: pinned,
    autoStartTimer: autoStartTimerEnabled(userDataDir),
    closeChoiceRemembered: rememberedCloseAction(userDataDir) !== null,
  };
  const key = JSON.stringify(state);
  if (key === lastTrayMenuState) return;
  lastTrayMenuState = key;
  tray.setContextMenu(
    Menu.buildFromTemplate(
      trayMenuTemplate(state, {
        openApp: reopenMainWindow,
        toggleTimer: () => toggleTimerFromTray?.(),
        trackProject: (projectId) => trackProjectFromTray?.(projectId),
        signOut: () => void confirmSignOutFromTray(),
        openWeb: (url) => void shell.openExternal(url),
        toggleCompactAlwaysOnTop: () => {
          setCompactAlwaysOnTop(userDataDir, !pinned);
          applyPinning();
          refreshTrayMenu();
        },
        toggleAutoStartTimer: () => {
          setAutoStartTimer(userDataDir, !autoStartTimerEnabled(userDataDir));
          refreshTrayMenu();
        },
        forgetCloseChoice: () => {
          rememberCloseAction(userDataDir, null);
          refreshTrayMenu();
        },
        checkForUpdates: () => void checkForUpdatesFromTray(),
        showAbout: () => void showAboutFromTray(),
        quit: () => app.quit(),
      }),
    ),
  );
}

/**
 * Signing out costs a trip to the browser to sign back in, and pauses a
 * running timer — too much for one stray click on a menu item.
 */
async function confirmSignOutFromTray(): Promise<void> {
  const { response } = await dialog.showMessageBox({
    type: "question",
    message: "Sign out of Hi Day?",
    detail: trayTimerRunning
      ? "Your timer will be paused, and signing back in means approving this device in your browser again."
      : "Signing back in means approving this device in your browser again.",
    buttons: ["Sign out", "Cancel"],
    defaultId: 1,
    cancelId: 1,
  });
  if (response === 0) signOutFromTray?.();
}

/** Always answers, even with "nothing found": a click that shows nothing reads as broken. */
async function checkForUpdatesFromTray(): Promise<void> {
  const outcome = await manualUpdateOutcome(
    getAutoUpdateState(),
    app.isPackaged && supportsSilentAutoUpdate(process.platform),
    checkForUpdatesNow,
    () => checkForUpdate(app.getVersion()),
  );
  const shown = updateDialogFor(outcome, app.getVersion());
  const { response } = await dialog.showMessageBox({
    type: "info",
    message: shown.message,
    detail: shown.detail,
    buttons: shown.buttons,
    defaultId: 0,
    cancelId: shown.buttons.length - 1,
  });
  if (response !== 0) return;
  if (shown.action === "restart") {
    // As the window's own restart button does — see `update:restart`.
    isQuitting = true;
    restartToApplyUpdate();
  } else if (shown.action === "openReleases") {
    await shell.openExternal(RELEASES_PAGE_URL);
  }
}

/** A message box rather than `app.showAboutPanel`, which Linux barely has. */
async function showAboutFromTray(): Promise<void> {
  await dialog.showMessageBox({
    type: "info",
    message: "Hi Day",
    detail: `Version ${app.getVersion()}`,
    buttons: ["OK"],
  });
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
  /**
   * The last answers the server gave, so this app can still be used when
   * nobody can answer (docs/adr/0025-...). Everything read through
   * `cachedDeviceRead` below writes through to it on the way past.
   */
  const offlineCache = new OfflineCache(app.getPath("userData"));
  /** An idle stretch the timer is stopped for, until it is kept or discarded. */
  const idleHoldStore = new IdleHoldStore(app.getPath("userData"));
  // Backed by the cache rather than memory, so a timer started offline can
  // still be stopped after a restart — before this, it could not.
  const pendingOps = new PendingTimerOps(app.getPath("userData"), {
    read: () => offlineCache.read().runningEntry,
    write: (entry) => offlineCache.rememberRunning(entry),
  });
  const apiClient = new ApiClient(API_BASE_URL, offlineSimulated);

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
  readCaptureReport = () => {
    const platform = toDevicePlatform(process.platform);
    return {
      appCapture: assessAppCapture({
        platform,
        isWayland: isWaylandSession(),
        x11: x11WindowTracker?.state ?? 'down',
        atspi: gnomeWindowFocusTracker?.state ?? 'down',
        atspiFailure: gnomeWindowFocusTracker?.failureReason ?? null,
        // Never loaded on Linux: inside Electron on Wayland it segfaults.
        nativeAddonLoaded: platform !== 'linux' && loadActiveWindowModule() !== null,
      }),
      urlCapture: assessUrlCapture({
        resolver: resolverOrchestrator?.healthSnapshot() ?? null,
        // Scanned only while URL capture runs: off, there is nothing to report.
        blindBrowsers:
          platform === "linux" && resolverOrchestrator ? findBlindBrowserNames() : [],
      }),
      displaySession: describeDisplaySession(platform, readSessionEnvironment()),
    };
  };

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
  let idleSampleTicker: ReturnType<typeof setInterval> | null = null;

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
  /** The tray's own start/stop confirmation, kept apart from the alert above. */
  let timerNotification: Notification | null = null;
  let trackingAlertDwell: ReturnType<typeof setTimeout> | null = null;
  let screenshotsEnabled = false;
  let screenshotFrequencyMs = DEFAULT_SCREENSHOT_INTERVAL_MS;
  let timerRunning = false;
  /** What the renderer was last told about capture being paused. */
  let capturePauseAnnounced = false;

  /**
   * Whether capture may run at all right now. Tracking time has no such
   * limit — an outage is no reason to stop paying somebody — but capture
   * does: these settings say whether this person's screen may be
   * photographed, and an admin who switches that off is owed an upper
   * bound on how long a machine that never heard them keeps going
   * (docs/adr/0025-...). Told, not silent: capture disappearing without
   * explanation is the same opacity this product exists to avoid.
   */
  function capturePaused(): boolean {
    return authStore.load() !== null && offlineCache.captureTrustLapsed();
  }

  function captureAllowed(): boolean {
    const paused = capturePaused();
    // On the change only, and in both directions — saying it once and
    // never withdrawing it leaves the banner up for the rest of the
    // session after the connection comes back.
    if (paused !== capturePauseAnnounced) {
      capturePauseAnnounced = paused;
      mainWindow?.webContents.send("capture:paused", paused);
    }
    return !offlineCache.captureTrustExpired();
  }

  // Asked at startup, and after a renderer crash takes the banner with
  // it: `captureAllowed` only speaks on a change, so a fresh window needs
  // to be able to ask where things stand.
  ipcMain.handle("capture:pausedState", (): boolean => capturePaused());

  function recomputeSampling(): void {
    const mayCapture = captureAllowed();
    if (appUrlTracking !== "off" && timerRunning && mayCapture) {
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
      // Main's own reading of when input stopped, for the moment the machine
      // sleeps: the renderer's poll is throttled while its window sits
      // hidden in the tray, and a stale reading would date the idle stretch
      // from the sleep instead of from when the person left.
      idleSampleTicker ??= setInterval(() => {
        void readIdleSeconds().then((seconds) => {
          lastIdleReading = { seconds, atMs: Date.now() };
        });
      }, IDLE_SAMPLE_INTERVAL_MS);
    } else if (activityTicker) {
      clearInterval(activityTicker);
      activityTicker = null;
      if (idleSampleTicker) clearInterval(idleSampleTicker);
      idleSampleTicker = null;
      // Emit the part-finished period rather than discarding the minutes
      // already measured, then push it out with the rest.
      void activitySampler.flush().then(() => activitySampleUploader.flush());
    }

    screenshotSampler.setIntervalMs(screenshotFrequencyMs);
    if (screenshotsEnabled && timerRunning && mayCapture) {
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
  /** showMainWindow already fights for the foreground; this adds a
   * flashing taskbar entry for the manager that refuses even that. */
  function raiseWindowInsistently(): void {
    showMainWindow();
    if (!mainWindow) return;

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
    // Only ever raised for a timer stopped *for* the person — a work time
    // limit, an app the organisation does not allow.
    timerStoppedByAgent = true;
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
  /**
   * Whether the agent ended the timer itself — an idle timeout, a sleep, a
   * day boundary, a limit the organisation set — rather than the person
   * pressing stop. The not-tracking reminder is for someone who forgot to
   * start their timer, so it stays quiet for a stop they did not make. Set
   * wherever a timer ends, cleared wherever one runs again; the handlers
   * below are the only places either happens.
   */
  let timerStoppedByAgent = false;

  function deliverReminder(
    settings: ReminderSettings,
    untrackedMinutes: number,
    signedOut: boolean,
  ): void {
    if (settings.delivery === "alert") {
      // The renderer composes the wording: only it knows how much was
      // tracked today, which decides what the reminder can honestly say.
      mainWindow?.webContents.send("tracking:reminder", {
        untrackedMinutes,
        signedOut,
        workingHoursPerDay: settings.workingHoursPerDay,
      });
      raiseWindowInsistently();
      return;
    }

    if (!Notification.isSupported()) return;
    // One line, so the tray popup says the one thing that matters.
    trackingNotification?.close();
    trackingNotification = new Notification({
      title: "Not tracking time",
      body: signedOut
        ? "Open Hi Day and log in to start tracking."
        : "You're not tracking time.",
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
    const idleSeconds = await readIdleSeconds();
    const due = shouldRemind({
      settings,
      now,
      isTracking: signedOut ? false : timerRunning,
      idleSeconds,
      since: untrackedSince,
      stoppedByAgent: timerStoppedByAgent,
      awaitingIdleAnswer: idleHoldStore.load() !== null,
    });
    if (!due || !settings) return;

    // Asked only once a reminder is otherwise due, so it costs one call per
    // reminder rather than one per tick. Signed out there is nobody to ask.
    if (!signedOut && (await hasTrackedFullWorkDayToday(settings))) {
      // Spent, not deferred: the day is full now and still will be in ten
      // minutes, so holding the slot would only fire the moment they log in.
      untrackedSince = now;
      return;
    }

    // Read again, as late as possible: the totals above are a network round
    // trip, and an idle timeout landing inside it would otherwise collect
    // this reminder on top of its question. The slot is not spent — the
    // nudge is still owed once that question is answered.
    if (idleHoldStore.load()) return;

    const untrackedMinutes = Math.round(
      (now.getTime() - untrackedSince.getTime()) / 60_000,
    );
    untrackedSince = now;
    deliverReminder(settings, untrackedMinutes, signedOut);
  }

  /**
   * Read from the same endpoint the window totals the day with, so the two
   * cannot disagree. A failed read reminds rather than staying silent: a
   * nudge too many beats a day of untracked time nobody was told about.
   */
  async function hasTrackedFullWorkDayToday(
    settings: ReminderSettings,
  ): Promise<boolean> {
    const now = new Date();
    const from = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).toISOString();

    const result = await callDeviceApi((token) =>
      apiClient.getCompletedTotals(token, from, now.toISOString()),
    );
    if (!result.ok) return false;

    return hasTrackedFullWorkDay(
      result.data.workedSeconds,
      settings.workingHoursPerDay,
    );
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
        offlineCache.remember({ captureSettings: settings });
        // Where the dashboard is, straight from the deployment. Arrives
        // on every poll, so a packaged build has it without anyone having
        // to pair again, and a move to a new domain needs no release.
        if (settings.webAppUrl) {
          rememberWebAppUrl(app.getPath("userData"), settings.webAppUrl);
          refreshTrayMenu();
        }
      }
      recomputeSampling();
    },
  );
  const timerStatusGate = new TimerStatusGate(
    authStore,
    apiClient,
    (running) => {
      timerRunning = running;
      // The tray's label follows the timer, whoever started it — the web
      // console and another device both reach this through the gate.
      trayTimerRunning = running;
      refreshTrayMenu();
      applyRecordingIndicator(running);
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
  /**
   * What the agent knew when last running, applied before any poll can
   * answer. Launched with no connection, both gates would otherwise
   * begin at "off" and stay there.
   */
  /**
   * A timer still marked as running when the app starts means it did not
   * shut down: every ordinary quit, sleep and system shutdown pauses the
   * timer first (see the `before-quit` and `powerMonitor` handlers), and
   * pausing clears this. So what is left here is a crash or a power cut,
   * and the stretch between the last sign of life and now is time nobody
   * can account for — the app was not running to observe it.
   *
   * Read once, before any poll can overwrite it with the server's own
   * answer. What is done with it — kept, asked about, or ended where it
   * was last seen alive — is `recoveryActionFor`'s call.
   */
  const recoveredTimer = ((): RecoveredTimer | null => {
    const session = authStore.load();
    if (!session) return null;
    const state = offlineCache.readFor(session.deviceId);
    if (!state.runningEntry || !state.runningSeenAt) return null;
    return {
      startedAt: state.runningEntry.startedAt,
      lastSeenAt: state.runningSeenAt,
      projectId: state.runningEntry.projectId,
      taskId: state.runningEntry.taskId,
      // Measured here rather than in the renderer, so both the auto-answer
      // below and the prompt agree on one reading of the clock.
      silentForMs: Math.max(
        0,
        Date.now() - new Date(state.runningSeenAt).getTime(),
      ),
    };
  })();

  const recoveryAction = recoveredTimer
    ? recoveryActionFor(recoveredTimer.silentForMs)
    : null;

  /** Null unless there is a question only the person can answer. */
  let awaitingRecoveryAnswer =
    recoveryAction === "ask" ? recoveredTimer : null;

  /**
   * Carries on after "yes, I was still working". Usually nothing. Past
   * the backend's half-hour grace the entry has already been closed at
   * the last heartbeat, so a stop dated now extends it to this moment —
   * the server only extends one it closed itself — and a fresh start
   * carries the same work forward. Two touching entries, the shape
   * `switch` already produces; reopening would need an endpoint that
   * does not exist.
   */
  const continueRecoveredTimer = async (
    recovered: RecoveredTimer,
  ): Promise<void> => {
    const current = await callDeviceApi((token) =>
      apiClient.getCurrentTimer(token),
    );
    const action = keepActionFor({
      answered: current.ok,
      running: current.ok && current.data.entry !== null,
    });
    if (action === "carry-on") return;

    await callDeviceApi((token) => pendingOps.stopAt(token, apiClient));
    await callDeviceApi((token) =>
      pendingOps.start(token, recovered.projectId, recovered.taskId, apiClient),
    );
    applyLocalTimerState();
  };

  /** Ends the recovered entry where the app was last known to be running. */
  const endRecoveredTimerAtLastSeen = async (
    lastSeenAt: string,
  ): Promise<void> => {
    awaitingRecoveryAnswer = null;
    const result = await callDeviceApi((token) =>
      pendingOps.stopAt(token, apiClient, lastSeenAt),
    );
    rememberWorkFinishedOffline(result);
    void timerStatusGate.pollOnce();
  };

  // `keep` needs nothing done: the entry is already open and the gates
  // are primed from it below, so the clock simply carries on.
  if (recoveryAction === "end" && recoveredTimer) {
    void endRecoveredTimerAtLastSeen(recoveredTimer.lastSeenAt).catch(() => {});
  }

  /** What the renderer should ask about, if anything. */
  ipcMain.handle(
    "tracking:recoveredTimer",
    (): RecoveredTimer | null => awaitingRecoveryAnswer,
  );

  /**
   * `keep` leaves the entry running: the person says they were working
   * through, and the clock simply resumes. `discard` ends it at the last
   * sign of life. Either way nothing is invented — the only question is
   * who the unobserved minutes belong to, and only they can answer it.
   */
  ipcMain.handle(
    "tracking:answerRecoveredTimer",
    async (_event, keep: boolean): Promise<void> => {
      const pending = awaitingRecoveryAnswer;
      awaitingRecoveryAnswer = null;
      if (!pending) return;
      if (keep) {
        await continueRecoveredTimer(pending);
        return;
      }
      await endRecoveredTimerAtLastSeen(pending.lastSeenAt);
    },
  );

  function primeGatesFromCache(): void {
    const session = authStore.load();
    if (!session) return;
    const cached = offlineCache.readFor(session.deviceId);
    if (cached.captureSettings) captureSettingsGate.prime(cached.captureSettings);
    // Only the entry's existence: a paused entry is not running, same rule
    // the gate's own poll applies.
    if (cached.runningEntry && !cached.runningEntry.pausedAt) {
      pendingOps.remember(cached.runningEntry);
      timerStatusGate.prime(true);
    }
  }
  primeGatesFromCache();

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
  // Nothing is decided here; the renderer owns all of it.
  toggleTimerFromTray = (): void => {
    // Deliberately not raised: the tray item is for someone who did not
    // want to come back to the window. It still has to exist to be told,
    // and creating one shows it — rare enough to live with.
    if (!mainWindow) showMainWindow();
    mainWindow?.webContents.send("tray:toggleTimer");
  };
  trackProjectFromTray = (projectId: string): void => {
    showMainWindow();
    mainWindow?.webContents.send("tray:trackProject", projectId);
  };
  // Through the window's own button, so it lands on the login view too.
  signOutFromTray = (): void => {
    showMainWindow();
    mainWindow?.webContents.send("tray:signOut");
  };
  trayAccount = () => {
    const session = authStore.load();
    if (!session) return { session: null, recentProjects: [] };
    const cached = offlineCache.read();
    return {
      session: {
        email: session.email,
        name: session.name,
        organisationName: session.organisationName,
      },
      // Off for the organisation means no Project to start a timer on.
      recentProjects:
        cached.projectsEnabled === false
          ? []
          : recentProjectsFor(recentProjectIds(session), cached.projects),
    };
  };

  ipcMain.handle("tracking:alert", (_event, body: string): void => {
    alertTrackingStopped(typeof body === "string" ? body : "");
  });

  /**
   * What the tray's Start/Stop did, for someone who is not looking at the
   * window — the only sign of it otherwise is the menu's own label. Quiet
   * on purpose: no raise, no flashing taskbar, unlike `tracking:alert`.
   */
  ipcMain.handle("window:timerNotice", (_event, body: string): void => {
    if (!Notification.isSupported() || typeof body !== "string") return;
    timerNotification?.close();
    timerNotification = new Notification({ title: "Hi Day", body });
    timerNotification.on("click", showMainWindow);
    timerNotification.show();
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
      // The same link tells us where the web app lives; the tray's
      // dashboard item has no other source for it.
      rememberWebAppUrl(app.getPath("userData"), result.approvalUrl);
      refreshTrayMenu();
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
      refreshTrayMenu();
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
      // Projects, settings and totals all belong to the session that just
      // ended — none of it is this machine's to keep, or to show whoever
      // signs in next.
      offlineCache.clear();
      idleHoldStore.clear();
      timerStoppedByAgent = false;
    }
    stopUrlCapture();
    stopHeartbeat();
    stopSync();
    // No session left to poll against — both gates resolve to "off",
    // which stops the sampler if it was running.
    void captureSettingsGate.pollOnce();
    void timerStatusGate.pollOnce();
    refreshTrayMenu();
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
      // Only an answer that actually came from the server: this is what
      // the staleness of the cache, and the capture trust window, are
      // measured from, and the offline queue answers `ok` for actions it
      // merely wrote down. Counting those would have a device that has
      // been unreachable for a fortnight report itself as in touch every
      // time somebody pressed play.
      if (!result.fromCache) offlineCache.rememberContact();
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
      // That session is over, and the signed-out reminder is about logging
      // back in rather than about any stop.
      timerStoppedByAgent = false;
      // None of it is this machine's to keep once the session is gone.
      offlineCache.clear();
      stopUrlCapture();
      stopHeartbeat();
      stopSync();
    }
    return result;
  }

/**
   * A read the cache can answer when the server cannot. These used to
   * fail outright offline, and the renderer's setup stopped at the first
   * of them. `remember` runs on the way past, so the copy is the last
   * real answer; `recall` serves it only when nothing reached the server.
   * A 403 or a sign-out is an answer and is passed through.
   */
  async function cachedDeviceRead<T>(
    call: (deviceToken: string) => Promise<TrackingResult<T>>,
    remember: (data: T) => void,
    recall: () => T | null,
  ): Promise<TrackingResult<T>> {
    const result = await callDeviceApi(call);
    if (result.ok) {
      remember(result.data);
      return result;
    }
    if (!isTransportFailure(result)) return result;
    const cached = recall();
    return cached === null ? result : { ok: true, data: cached, fromCache: true };
  }

  // Exposed to the app-lifecycle hooks (quit/suspend/shutdown) so they can
  // pause rather than abandon a running timer. Pausing an entry that is
  // already paused, or when none is running, is a no-op the backend rejects
  // harmlessly — so callers never need to check first.
  pauseRunningTimer = async (): Promise<void> => {
    const session = authStore.load();
    if (!session) return;
    // Durably: this runs while the OS is already shutting the machine
    // down, and a stop lost between asking the server and writing it down
    // leaves an entry open overnight. See `pauseDurably`.
    const result = await pendingOps.pauseDurably(session.deviceToken, apiClient);
    // So the day the machine comes back to still knows about the stretch
    // that ended as it went away.
    rememberWorkFinishedOffline(result);
  };

  // Sleep is idle time too. Rather than ending the entry at the moment of
  // sleep and leaving it ended — which stopped tracking for someone back
  // well inside the timeout, since a laptop on battery suspends after 15
  // minutes and the timeout may be 20 — it is ended where input stopped and
  // held. On wake the renderer picks it up again from there, or asks, by
  // how long the person was away (src/renderer/idle-hold.ts). With idle
  // handling off there is no timeout to measure against, so sleep still
  // just pauses.
  holdRunningTimerForSleep = (): void => {
    const session = authStore.load();
    const running = pendingOps.current();
    const policy = offlineCache.read().idlePolicy;
    // Only when there is a running timer for the sleep to end: marking a
    // sleep that stopped nothing would silence the next morning's nudge.
    if (running && !running.pausedAt) timerStoppedByAgent = true;
    if (!session || !running || running.pausedAt || !policy || policy.handling === "off") {
      void pauseRunningTimer?.().catch((error: unknown) =>
        console.error("[timer] pause on suspend failed:", error),
      );
      return;
    }
    const idleStartedAt = new Date(
      whenInputStopped(lastIdleReading, Date.now()),
    ).toISOString();
    // Written before the stop, so a machine that never wakes still has it.
    idleHoldStore.save({
      projectId: running.projectId,
      taskId: running.taskId,
      idleStartedAt,
      returnedAt: null,
      reason: "sleep",
    });
    void pendingOps
      .pauseDurably(session.deviceToken, apiClient, idleStartedAt)
      .then(rememberWorkFinishedOffline)
      .catch((error: unknown) => console.error("[timer] hold on suspend failed:", error));
  };
  markIdleReturnedOnWake = (): void => {
    const hold = idleHoldStore.markReturned(new Date().toISOString());
    if (hold) mainWindow?.webContents.send("idle:wake");
  };

  // Offline pauses/starts are only real to the server once this lands, so
  // reading the timer settles them first.
  /** Everything still waiting to reach the server, as one number. */
  const unsentRecordCount = (): number =>
    offlineQueue.pendingCount() +
    pendingOps.load().length +
    (urlCaptureService?.unsentCount() ?? 0);

  /** When the quit dialog went up, so it cannot vanish as a flicker. */
  let quitProgressShownAt: number | null = null;
  /** When it will give up, shared so the countdown and the loop agree. */
  let quitDeadline = 0;

  /**
   * How long is left, in whole seconds. Counted from one deadline rather
   * than from the loop's own progress, so what the person sees ticking
   * down is the thing that actually decides when the app goes.
   */
  const sendQuitProgress = (remaining: number): void => {
    mainWindow?.webContents.send("sync:draining", {
      remaining,
      secondsLeft: Math.max(0, Math.ceil((quitDeadline - Date.now()) / 1000)),
    });
  };

  /**
   * Put up the moment Quit is pressed, before anything slow starts.
   *
   * Stopping the timer is a network call, so even a quit with an empty
   * queue leaves the window on screen for a moment with nothing
   * explaining why it has not gone — which reads as the app having hung.
   */
  beginQuitProgress = (): void => {
    quitProgressShownAt = Date.now();
    quitDeadline = Date.now() + QUIT_DRAIN_LIMIT_MS;
    showMainWindow();
    sendQuitProgress(unsentRecordCount());
  };

  /**
   * Holds the quit open while the queue drains, showing the count fall.
   * A number that is not moving says more than any wording, and Close
   * leaves whenever they like — nothing is lost either way, since the
   * data goes up on the next launch. Bounded by `QUIT_DRAIN_LIMIT_MS`:
   * the person is waiting on the app to go.
   */
  drainBeforeQuit = async (): Promise<void> => {
    let closed = false;
    const onClose = (): void => {
      closed = true;
    };
    ipcMain.once("sync:drainClosed", onClose);

    // On its own timer, not the loop's: an attempt against an
    // unreachable server takes the whole budget to fail, so a countdown
    // driven by the loop would sit on 5 and then vanish. What somebody is
    // watching has to keep moving even when nothing else is.
    let lastKnown = unsentRecordCount();
    const ticker = setInterval(() => sendQuitProgress(lastKnown), 1000);

    try {
      while (!closed && Date.now() < quitDeadline) {
        // Checked first, so a quit with nothing queued does no network
        // work at all and only pays the moment the dialog is up for.
        if (unsentRecordCount() === 0) break;
        await Promise.all([
          offlineQueue.flushAll().catch(() => {}),
          urlCaptureService?.drainOnce().catch(() => {}) ?? Promise.resolve(),
          flushPendingOps().catch(() => {}),
        ]);
        const remaining = unsentRecordCount();
        lastKnown = remaining;
        sendQuitProgress(remaining);
        if (remaining === 0) break;
        // Short, so the deadline buys as many real attempts as it can.
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    } finally {
      clearInterval(ticker);
      ipcMain.removeListener("sync:drainClosed", onClose);
      // A dialog that appears and disappears inside a frame reads as a
      // glitch rather than as the app doing something, so the quickest
      // quit still shows it long enough to have been deliberate.
      const shownFor = Date.now() - (quitProgressShownAt ?? Date.now());
      if (shownFor < QUIT_PROGRESS_MIN_VISIBLE_MS) {
        await new Promise((resolve) =>
          setTimeout(resolve, QUIT_PROGRESS_MIN_VISIBLE_MS - shownFor),
        );
      }
      mainWindow?.webContents.send("sync:draining", null);
    }
  };

  /** What the renderer was last told about data waiting to go up. */
  let backlogAnnounced = false;

  /**
   * Tells the person when tracked data has stopped going up. The queue
   * makes an outage cost nothing, which is also why it can fail quietly.
   * The calm "Can't reach Hi Day — retrying" line reads as transient,
   * and this is not. On the same 15s tick as the op replay, announced
   * only on the change in both directions.
   */
  const checkSyncBacklog = (): void => {
    const warn =
      authStore.load() !== null &&
      shouldWarnAboutBacklog({
        hasUnsent:
          pendingOps.hasPending() ||
          offlineQueue.hasUnsent() ||
          urlCaptureService?.hasUnsent() === true,
        silentForMs: offlineCache.silentForMs(),
      });
    if (warn === backlogAnnounced) return;
    backlogAnnounced = warn;
    mainWindow?.webContents.send("sync:backlog", warn ? BACKLOG_MESSAGE : null);
  };

  // Asked at startup and after a renderer crash, since the event above
  // only fires on a change.
  ipcMain.handle("sync:backlogState", (): string | null =>
    backlogAnnounced ? BACKLOG_MESSAGE : null,
  );

  const flushPendingOps = async (): Promise<void> => {
    const session = authStore.load();
    if (!session) return;
    const { settled, refused } = await pendingOps.flush(
      session.deviceToken,
      apiClient,
    );
    // Hours the server would not take. They used to be dropped in
    // silence, which left somebody to find the hole in their own
    // timesheet weeks later; now they are told while they can still
    // remember what they were doing.
    if (refused.length > 0) {
      mainWindow?.webContents.send("tracking:refused", refused);
    }
    if (settled) void timerStatusGate.pollOnce();
    checkSyncBacklog();
  };
  setInterval(() => {
    // Liveness first, and independent of whether anything can be reached:
    // this is what crash recovery measures its gap from, and leaving it
    // to the server's answers made an outage indistinguishable from a
    // crash (see `OfflineCache.touchRunning`).
    offlineCache.touchRunning();
    void flushPendingOps().catch(() => {});
  }, 15_000);

  /**
   * Applies what this app just did, then asks the server to confirm.
   *
   * `pollOnce` holds its last value when the server cannot answer, which
   * is right for a poll and wrong straight after this app's own start:
   * the gate kept "not running", so the tray read "not tracking" and —
   * since `timerRunning` gates `recomputeSampling` — window tracking,
   * screenshots and URL capture all stayed off behind a running timer.
   * Priming first and polling after lets the server still win.
   */
  /**
   * Keeps the day's totals honest across the machine being switched off.
   *
   * A stretch finished while the server was unreachable is only in the
   * queue, so nothing has reported it and the cached totals do not know
   * about it. That is invisible within a session — the renderer keeps its
   * own tally — and very visible after a restart, where the day would
   * come back as though the work had never happened. Only `fromCache`
   * results: anything the server answered is already in its own figures.
   */
  const rememberWorkFinishedOffline = (
    result: TrackingResult<TimeEntry>,
  ): void => {
    if (!result.ok || !result.fromCache) return;
    const entry = result.data;
    if (!entry?.endedAt) return;
    const seconds =
      Math.round(
        (Date.parse(entry.endedAt) - Date.parse(entry.startedAt)) / 1000,
      ) - (entry.pausedSeconds ?? 0);
    offlineCache.addWorkedSeconds(entry.projectId, seconds);
  };

  const applyLocalTimerState = (): void => {
    const current = pendingOps.current();
    timerStatusGate.prime(current !== null && !current.pausedAt);
    void timerStatusGate.pollOnce();
  };

  ipcMain.handle("tracking:projectsSetting", () =>
    cachedDeviceRead(
      (token) => apiClient.getProjectsSetting(token),
      ({ projectsEnabled }) => {
        offlineCache.remember({ projectsEnabled });
        refreshTrayMenu();
      },
      () => {
        const enabled = offlineCache.read().projectsEnabled;
        return enabled === null ? null : { projectsEnabled: enabled };
      },
    ),
  );

  ipcMain.handle("tracking:listProjects", () =>
    cachedDeviceRead(
      (token) => apiClient.listProjects(token),
      (projects) => {
        offlineCache.remember({ projects });
        // The names under "Recent projects" come from this list.
        refreshTrayMenu();
      },
      () => offlineCache.read().projects,
    ),
  );

  ipcMain.handle("tracking:listTasks", (_event, projectId: string) =>
    cachedDeviceRead(
      (token) => apiClient.listTasks(token, projectId),
      ({ tasks }) => offlineCache.rememberTasks(projectId, tasks),
      () => {
        const tasks = offlineCache.read().tasks[projectId];
        return tasks ? { tasks } : null;
      },
    ),
  );

  // Remembering the Project on the way through means the renderer never has
  // to manage it: whatever the timer last actually started against is what a
  // later play resumes to.
  ipcMain.handle(
    "tracking:start",
    async (
      _event,
      projectId: string | null,
      taskId: string | null,
      startedAt?: string,
    ) => {
      const result = await callDeviceApi((token) =>
        pendingOps.start(token, projectId, taskId, apiClient, startedAt),
      );
      if (result.ok && projectId !== null) {
        authStore.rememberProject(projectId, taskId);
      }
      // Tracking again: whatever stopped the last timer is settled, and
      // the next stop speaks for itself.
      if (result.ok) timerStoppedByAgent = false;
      // Instant local feedback for window tracking rather than waiting on
      // TimerStatusGate's poll; the periodic poll still covers a timer
      // started or stopped elsewhere.
      applyLocalTimerState();
      return result;
    },
  );

  ipcMain.handle(
    "tracking:switch",
    async (_event, projectId: string | null, taskId: string | null) => {
      const result = await callDeviceApi((token) =>
        pendingOps.switchTo(token, projectId, taskId, apiClient),
      );
      if (result.ok && projectId !== null) {
        authStore.rememberProject(projectId, taskId);
      }
      if (result.ok) timerStoppedByAgent = false;
      applyLocalTimerState();
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

  // Through the queue, not straight at the server: an idle discard with
  // no connection used to fail outright, leaving the timer running
  // through exactly the stretch it was meant to cut off.
  ipcMain.handle("tracking:stop", async (_event, endedAt?: string) => {
    // Never the stop button: the renderer only reaches for this at the
    // idle timeout, on an auto-subtract, and at a day boundary.
    timerStoppedByAgent = true;
    await flushPendingOps();
    const result = await callDeviceApi((token) =>
      pendingOps.stopAt(token, apiClient, endedAt),
    );
    // `callDeviceApi` only remembers an entry that is still open, so a
    // stop leaves the last running one behind it — which would then read
    // as still running below.
    if (result.ok) pendingOps.remember(null);
    rememberWorkFinishedOffline(result);
    applyLocalTimerState();
    return result;
  });

  /**
   * Offline this answers from the cache rather than failing, which is
   * what lets the clock keep ticking instead of resetting to nothing.
   * `workedSeconds` is carried forward from when it was last heard, plus
   * the time the entry has been running since — the honest projection of
   * a figure nobody can confirm, rather than a zero that is simply wrong.
   */
  ipcMain.handle("tracking:status", async () => {
    await flushPendingOps();
    return cachedDeviceRead(
      (token) => apiClient.getCurrentTimer(token),
      (current) =>
        offlineCache.remember({
          workedSeconds: current.workedSeconds ?? null,
          workedSecondsAt: new Date().toISOString(),
        }),
      (): CurrentTimer | null => {
        const state = offlineCache.read();
        const entry = state.runningEntry;
        const since =
          entry && state.workedSecondsAt
            ? Math.max(
                0,
                Math.floor(
                  (Date.now() - new Date(state.workedSecondsAt).getTime()) / 1000,
                ),
              )
            : 0;
        return {
          entry,
          now: new Date().toISOString(),
          workedSeconds: (state.workedSeconds ?? 0) + since,
        };
      },
    );
  });

  ipcMain.handle("tracking:pause", async () => {
    // The stop button, in the window or the tray. Pausing ends the entry,
    // so this is what "the person stopped tracking" looks like.
    timerStoppedByAgent = false;
    const result = await callDeviceApi((token) =>
      pendingOps.pause(token, apiClient),
    );
    rememberWorkFinishedOffline(result);
    // Instant local feedback rather than waiting on TimerStatusGate's poll —
    // capture must stop as soon as the person pauses, not up to 15s later.
    applyLocalTimerState();
    return result;
  });

  ipcMain.handle("tracking:resume", async () => {
    const result = await callDeviceApi((token) => apiClient.resumeTimer(token));
    if (result.ok) timerStoppedByAgent = false;
    void timerStatusGate.pollOnce();
    return result;
  });

  // Nothing to cache: this lists entries so the renderer can fold in time
  // added elsewhere, and offline there is nowhere else. An empty list is
  // the true answer — "nothing new" — and lets the totals read below,
  // which is where the day's figure actually comes from.
  ipcMain.handle(
    "tracking:entriesBetween",
    (_event, from: string, to: string) =>
      cachedDeviceRead(
        (token) => apiClient.listEntriesBetween(token, from, to),
        () => {},
        () => [],
      ),
  );

  /**
   * The day's totals, stamped with the day they belong to. Opening the
   * app with no connection shows the time already tracked rather than
   * zero — and on a new morning shows nothing rather than yesterday's,
   * since `todayTotals` withholds a stamp that is not today's.
   */
  ipcMain.handle(
    "tracking:completedTotals",
    (_event, from: string, to: string) =>
      cachedDeviceRead(
        (token) => apiClient.getCompletedTotals(token, from, to),
        (totals) => offlineCache.rememberToday(totals),
        () => offlineCache.todayTotals(),
      ),
  );

  /**
   * Whether this launch should start the timer by itself. Asked by the
   * renderer once setup has settled, because starting a timer is its job
   * and there must not be a second way to do it. The power-on is spent as
   * the decision is taken rather than once a timer is running — see
   * `decideAutoStart`.
   */
  ipcMain.handle("tracking:autoStartDue", (): boolean => {
    const userDataDir = app.getPath("userData");
    const boot = bootIdentity();
    const decision = decideAutoStart({
      enabled: autoStartTimerEnabled(userDataDir),
      boot,
      lastAutoStartedBoot: lastAutoStartedBoot(userDataDir),
      signedIn: authStore.load() !== null,
      // The remembered entry as well as the gate's answer: with no
      // connection the gate has nothing to report, and a machine still
      // finding its network must not start a second timer.
      timerRunning: timerRunning || pendingOps.current() !== null,
      awaitingIdleAnswer: idleHoldStore.load() !== null,
      awaitingRecoveredAnswer: recoveredTimer !== null,
    });
    if (decision !== "wait" && boot) rememberAutoStartedBoot(userDataDir, boot);
    return decision === "start";
  });

  // Cached like the rest, and for a sharper reason: with no policy the
  // renderer's idle check gives up entirely, so an offline machine left
  // running overnight records the whole night.
  ipcMain.handle("tracking:idlePolicy", () =>
    cachedDeviceRead(
      (token) => apiClient.getIdlePolicy(token),
      (idlePolicy) => offlineCache.remember({ idlePolicy }),
      () => offlineCache.read().idlePolicy,
    ),
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
    const seconds =
      gnomeMs !== null && gnomeMs !== undefined
        ? Math.floor(gnomeMs / 1000)
        : powerMonitor.getSystemIdleTime();
    lastIdleReading = { seconds, atMs: Date.now() };
    return seconds;
  });

  ipcMain.handle("idle:hold", (): IdleHold | null => idleHoldStore.load());
  ipcMain.handle("idle:setHold", (_event, hold: IdleHold): void => idleHoldStore.save(hold));
  ipcMain.handle("idle:markReturned", (_event, at: string): IdleHold | null =>
    idleHoldStore.markReturned(at),
  );
  ipcMain.handle("idle:clearHold", (): void => idleHoldStore.clear());

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

  ipcMain.handle(
    "window:setMode",
    (_event, mode: WindowMode, centre?: boolean): void => {
      setWindowMode(mode, centre === true);
    },
  );

  ipcMain.handle(
    "setup:browserRestartPrompt",
    (): BrowserRestartPrompt =>
      browserRestartPrompt({
        platform: process.platform,
        findBrowsers: () => browsersOpenBeforeActivation,
        log: (line) => console.log(line),
      }),
  );

  ipcMain.handle("setup:continueFromBrowserRestart", async (): Promise<void> => {
    // Exactly what the screen named, not the live set: a browser opened since
    // this launch started from the activated entry and has its launcher
    // binding, so restarting it would cost its tabs and fix nothing. One
    // closed in the meantime has no process left to signal, and `restart`
    // skips it rather than opening it on the person's behalf.
    const named = browsersOpenBeforeActivation.restartable;

    // Spent before the restart, not after: the person has given their answer,
    // and a browser that refuses to die must not buy them the same screen
    // again. Only this launch's set is cleared — a later sweep that orphans
    // windows afresh fills it again and earns its own screen.
    browsersOpenBeforeActivation = {
      restartable: [],
      manual: [],
      warnings: [],
    };

    if (process.platform !== "linux") return;

    const service = new BrowserRestartService({
      logger: (line) => console.log(line),
    });
    await service.restart(named);
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

  // Windows groups a running window with the taskbar shortcut that shares
  // its AppUserModelID. Without it (always the case under `pnpm dev`) a
  // pinned Hi Day and the running one show as two icons. Matches the
  // installer's appId (electron-builder.yml).
  if (process.platform === "win32") app.setAppUserModelId("io.hiday.app");

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
      // Before anything slow, so there is never a stretch where the
      // window is still up with nothing saying why.
      if (!quittingForPowerEvent) beginQuitProgress?.();
      void pauseRunningTimer()
        .catch((error: unknown) =>
          console.error("[timer] pause on quit failed:", error),
        )
        // Only once the timer is stopped: its own stop is one of the
        // records being counted, and draining before it would quit with
        // the very thing this waits for still unwritten.
        .then(async () => {
          if (quittingForPowerEvent || !drainBeforeQuit) return;
          await drainBeforeQuit().catch((error: unknown) =>
            console.error("[sync] drain on quit failed:", error),
          );
        })
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
  powerMonitor.on("suspend", () => {
    if (holdRunningTimerForSleep) holdRunningTimerForSleep();
    else pauseForPowerEvent("suspend");
  });
  powerMonitor.on("resume", () => markIdleReturnedOnWake?.());
  powerMonitor.on("shutdown", () => {
    isQuitting = true;
    quittingForPowerEvent = true;
    pauseForPowerEvent("shutdown");
  });

  // Logging out, and most graceful shutdowns, send SIGTERM rather than
  // anything Electron reports as a quit — without this the process dies with
  // the timer still running. Routed through app.quit() so it takes the same
  // pause-then-exit path as closing the window.
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => {
      // Whatever sent this is waiting on the process, not on a dialog.
      quittingForPowerEvent = true;
      app.quit();
    });
  }
}
