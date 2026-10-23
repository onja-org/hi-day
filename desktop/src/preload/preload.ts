import { contextBridge, ipcRenderer } from "electron";

export interface AuthStatus {
  loggedIn: boolean;
  email?: string;
  name?: string;
  organisationName?: string;
}

export interface StartPairingResult {
  ok: boolean;
  message?: string;
}

export type PairingPollResult =
  | { status: "pending" }
  | { status: "approved"; email: string; name: string; organisationName: string }
  | { status: "expired" }
  | { status: "error"; message: string };

export interface TrackedProject {
  id: string;
  name: string;
  colour: string;
  client: string | null;
}

export interface TrackedTask {
  id: string;
  name: string;
  description: string | null;
  status: "open" | "closed";
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntry {
  id: string;
  /** null when the organisation doesn't track time against Projects. */
  projectId: string | null;
  taskId: string | null;
  startedAt: string;
  endedAt: string | null;
  /** Non-null while the entry has an open pause span. */
  pausedAt: string | null;
  /** Total seconds paused so far, across every *closed* pause span. */
  pausedSeconds: number;
}

export interface LastProject {
  projectId: string;
  taskId: string | null;
}

export interface CompletedTotals {
  workedSeconds: number;
  /** This device's own entries alone, on the same baseline. */
  deviceSeconds: number;
  projects: { projectId: string; seconds: number }[];
}

export interface TrackedEntry {
  id: string;
  projectId: string | null;
  durationSeconds: number | null;
}

/** How quitting is going: what is left to send, and how long it will wait. */
export interface QuitProgress {
  remaining: number;
  secondsLeft: number;
}

/** A timer found still running at startup, after the app stopped unexpectedly. */
export interface RecoveredTimer {
  startedAt: string;
  lastSeenAt: string;
  silentForMs: number;
}

/** One queued operation the server refused when it was finally replayed. */
export interface RefusedTime {
  op: { type: "start" | "stop"; at: string };
  message: string;
}

export interface CurrentTimer {
  entry: TimeEntry | null;
  now: string;
  /**
  * The person's worked seconds across every device currently tracking,
  * counting wall-clock time two devices share only once. Displayed instead
  * of this device's own elapsed time, so a machine joining a timer already
  * running elsewhere shows the total already accrued (ADR-0022).
  */
  workedSeconds: number;
  /** Present on the one poll that ended the timer for reaching a limit. */
  limitReached?: { kind: "daily" | "weekly"; limitHours: number };
}

export type IdleHandling = "off" | "flag" | "auto_subtract";

export interface IdlePolicy {
  handling: IdleHandling;
  thresholdMinutes: number;
}

export type DesktopDevicePlatformName = "windows" | "macos" | "linux";

export interface CapturePermissionStatus {
  windowTrackingEnabled: boolean;
  /** What "Track apps & URLs" resolves to for this person. */
  appUrlTracking: "off" | "apps" | "apps_urls";
  screenshotsEnabled: boolean;
  platform: DesktopDevicePlatformName;
  screenRecordingGranted: boolean;
  /** macOS + Firefox only — see main.ts's CapturePermissionStatus. */
  accessibilityGranted: boolean;
  accessibilityGuidance: string;
  waylandUnsupported: boolean;
}

export type TrackingResult<T> =
  | { ok: true; data: T; fromCache?: boolean }
  | {
      ok: false;
      message: string;
      runningEntry?: TimeEntry;
      unauthorized?: boolean;
      /** HTTP status; absent when the server could not be reached. */
      status?: number;
    };

/**
 * The first-run screen asking for a browser restart: whether to show it at
 * all, and what it should say. Linux only — `show` is false everywhere
 * else, and false again once this install has answered once.
 */
export interface BrowserRestartPrompt {
  show: boolean;
  /** Browsers Continue will restart, by display name. */
  names: string[];
  /**
   * Browsers Continue cannot restart — no launcher to start them from — so
   * the person has to do it themselves. Named apart from `names` because
   * the screen must only promise what pressing the button actually does.
   */
  manual: { name: string; reason: string }[];
  /** What to tell them before they press Continue. */
  warnings: string[];
}

export interface UpdateCheckResult {
  updateAvailable: boolean;
  latestVersion?: string;
}

/** Mirrors AutoUpdateState in main/auto-updater.ts. */
export type AutoUpdatePhase =
  | "idle"
  | "checking"
  | "downloading"
  | "downloaded"
  | "unsupported";

export interface AutoUpdateState {
  phase: AutoUpdatePhase;
  latestVersion?: string;
  progressPercent?: number;
}

/** See docs/adr/0015-.... */
export type ConsentDecision = "granted" | "declined";

export interface ConsentStatus {
  required: boolean;
  /** `null` when there's nothing to show (no capture enabled, or none published yet). */
  disclosureVersionId: string | null;
  text: string | null;
}

/** Mirrors main's idle-hold-store.ts. */
interface IdleHold {
  projectId: string | null;
  taskId: string | null;
  idleStartedAt: string;
  returnedAt: string | null;
  reason: "timeout" | "sleep";
}

interface TrackingReminder {
  untrackedMinutes: number;
  signedOut: boolean;
  workingHoursPerDay: number;
}

const api = {
  getStatus: (): Promise<AuthStatus> =>
    ipcRenderer.invoke("auth:status") as Promise<AuthStatus>,
  auth: {
    startPairing: (): Promise<StartPairingResult> =>
      ipcRenderer.invoke("auth:startPairing") as Promise<StartPairingResult>,
    pairingStatus: (): Promise<PairingPollResult> =>
      ipcRenderer.invoke("auth:pairingStatus") as Promise<PairingPollResult>,
  },
  logout: (): Promise<AuthStatus> =>
    ipcRenderer.invoke("auth:logout") as Promise<AuthStatus>,
  tracking: {
    projectsSetting: (): Promise<TrackingResult<{ projectsEnabled: boolean }>> =>
      ipcRenderer.invoke("tracking:projectsSetting") as Promise<
        TrackingResult<{ projectsEnabled: boolean }>
      >,
    listProjects: (): Promise<TrackingResult<TrackedProject[]>> =>
      ipcRenderer.invoke("tracking:listProjects") as Promise<
        TrackingResult<TrackedProject[]>
      >,
    listTasks: (
      projectId: string,
    ): Promise<TrackingResult<{ tasks: TrackedTask[] }>> =>
      ipcRenderer.invoke("tracking:listTasks", projectId) as Promise<
        TrackingResult<{ tasks: TrackedTask[] }>
      >,
    start: (
      projectId: string | null,
      taskId: string | null,
      startedAt?: string,
    ): Promise<TrackingResult<TimeEntry>> =>
      ipcRenderer.invoke("tracking:start", projectId, taskId, startedAt) as Promise<
        TrackingResult<TimeEntry>
      >,
    switchTo: (
      projectId: string | null,
      taskId: string | null,
    ): Promise<TrackingResult<TimeEntry>> =>
      ipcRenderer.invoke("tracking:switch", projectId, taskId) as Promise<
        TrackingResult<TimeEntry>
      >,
    stop: (endedAt?: string): Promise<TrackingResult<TimeEntry>> =>
      ipcRenderer.invoke("tracking:stop", endedAt) as Promise<
        TrackingResult<TimeEntry>
      >,
    status: (): Promise<TrackingResult<CurrentTimer>> =>
      ipcRenderer.invoke("tracking:status") as Promise<
        TrackingResult<CurrentTimer>
      >,
    pause: (): Promise<TrackingResult<TimeEntry>> =>
      ipcRenderer.invoke("tracking:pause") as Promise<
        TrackingResult<TimeEntry>
      >,
    resume: (): Promise<TrackingResult<TimeEntry>> =>
      ipcRenderer.invoke("tracking:resume") as Promise<
        TrackingResult<TimeEntry>
      >,
    /**
     * A timer the app came back to find still running after a crash, if
     * there is one worth asking about — see main's `recoveredTimer`.
     */
    /** Where capture stands now — asked at startup, since the event only fires on a change. */
    /** Whether data is backed up now — asked at startup, since the event only fires on a change. */
    syncBacklog: (): Promise<string | null> =>
      ipcRenderer.invoke("sync:backlogState") as Promise<string | null>,
    capturePaused: (): Promise<boolean> =>
      ipcRenderer.invoke("capture:pausedState") as Promise<boolean>,
    recoveredTimer: (): Promise<RecoveredTimer | null> =>
      ipcRenderer.invoke("tracking:recoveredTimer") as Promise<RecoveredTimer | null>,
    /** `keep` leaves it running; otherwise it ends at the last sign of life. */
    answerRecoveredTimer: (keep: boolean): Promise<void> =>
      ipcRenderer.invoke("tracking:answerRecoveredTimer", keep) as Promise<void>,
    lastProject: (): Promise<LastProject | null> =>
      ipcRenderer.invoke("tracking:lastProject") as Promise<LastProject | null>,
    entriesBetween: (
      from: string,
      to: string,
    ): Promise<TrackingResult<TrackedEntry[]>> =>
      ipcRenderer.invoke("tracking:entriesBetween", from, to) as Promise<
        TrackingResult<TrackedEntry[]>
      >,
    completedTotals: (
      from: string,
      to: string,
    ): Promise<TrackingResult<CompletedTotals>> =>
      ipcRenderer.invoke("tracking:completedTotals", from, to) as Promise<
        TrackingResult<CompletedTotals>
      >,
    idlePolicy: (): Promise<TrackingResult<IdlePolicy>> =>
      ipcRenderer.invoke("tracking:idlePolicy") as Promise<
        TrackingResult<IdlePolicy>
      >,
    permissionStatus: (): Promise<TrackingResult<CapturePermissionStatus>> =>
      ipcRenderer.invoke("tracking:permissionStatus") as Promise<
        TrackingResult<CapturePermissionStatus>
      >,
    requestScreenRecordingAccess: (): Promise<void> =>
      ipcRenderer.invoke(
        "tracking:requestScreenRecordingAccess",
      ) as Promise<void>,
    openPrivacySettings: (
      pane: "accessibility" | "screenRecording",
    ): Promise<void> =>
      ipcRenderer.invoke("tracking:openPrivacySettings", pane) as Promise<void>,
  },
  idle: {
    seconds: (): Promise<number> =>
      ipcRenderer.invoke("idle:seconds") as Promise<number>,
    /** The idle stretch the timer is stopped for, if any — see src/renderer/idle-hold.ts. */
    hold: (): Promise<IdleHold | null> =>
      ipcRenderer.invoke("idle:hold") as Promise<IdleHold | null>,
    setHold: (hold: IdleHold): Promise<void> =>
      ipcRenderer.invoke("idle:setHold", hold) as Promise<void>,
    markReturned: (at: string): Promise<IdleHold | null> =>
      ipcRenderer.invoke("idle:markReturned", at) as Promise<IdleHold | null>,
    clearHold: (): Promise<void> =>
      ipcRenderer.invoke("idle:clearHold") as Promise<void>,
    /** The machine woke with a hold waiting. */
    onWake: (listener: () => void): void => {
      ipcRenderer.on("idle:wake", () => listener());
    },
  },
  urlCapture: {
    // Fire-and-forget push, not invoke — main has nothing to return, and the
    // renderer stays the authoritative source of "is a timer running".
    timerStateChanged: (running: boolean): void => {
      ipcRenderer.send("urlCapture:timerStateChanged", running);
    },
  },
  trackingAlert: (body: string): Promise<void> =>
    ipcRenderer.invoke("tracking:alert", body) as Promise<void>,

  windowControls: {
    minimise: (): Promise<void> =>
      ipcRenderer.invoke("window:minimise") as Promise<void>,
    show: (): Promise<void> =>
      ipcRenderer.invoke("window:show") as Promise<void>,
    // Hides to the tray; tracking keeps running.
    close: (): Promise<void> =>
      ipcRenderer.invoke("window:close") as Promise<void>,
    /** `centre` puts the full window in the middle of its display. */
    setMode: (
      mode: "full" | "compact" | "mini",
      centre?: boolean,
    ): Promise<void> =>
      ipcRenderer.invoke("window:setMode", mode, centre) as Promise<void>,
    /**
     * Hours a reconnect handed back that the server would not take. Gone
     * either way; this is so they hear it from the app rather than find
     * the gap in their timesheet later.
     */
    onRefusedTime: (
      listener: (refused: RefusedTime[]) => void,
    ): void => {
      ipcRenderer.on("tracking:refused", (_event, refused: RefusedTime[]) =>
        listener(refused),
      );
    },
    /**
     * Capture paused or resumed for being out of touch. Deliberately not
     * `onTrackingNotice`, which blocks the timer.
     */
    /**
     * Tracked data has stopped going up, or has started again. Carries
     * the message rather than a flag so the wording lives in one place,
     * next to the rule that decides when to show it.
     */
    /** Records still going up while quitting; null once it is over. */
    onSyncDraining: (
      listener: (progress: QuitProgress | null) => void,
    ): void => {
      ipcRenderer.on("sync:draining", (_event, progress: QuitProgress | null) =>
        listener(progress),
      );
    },
    /** Stop waiting and quit now; the data stays queued for next launch. */
    closeSyncDraining: (): void => {
      ipcRenderer.send("sync:drainClosed");
    },
    onSyncBacklog: (listener: (message: string | null) => void): void => {
      ipcRenderer.on("sync:backlog", (_event, message: string | null) =>
        listener(message),
      );
    },
    onCapturePaused: (listener: (paused: boolean) => void): void => {
      ipcRenderer.on("capture:paused", (_event, paused: boolean) =>
        listener(paused),
      );
    },
    /** The tray's Start/Stop item, which presses the renderer's own button. */
    onTrayToggleTimer: (listener: () => void): void => {
      ipcRenderer.on("tray:toggleTimer", () => listener());
    },
    /** A Project picked under the tray's "Recent projects". */
    onTrayTrackProject: (listener: (projectId: string) => void): void => {
      ipcRenderer.on("tray:trackProject", (_event, projectId: string) =>
        listener(projectId),
      );
    },
    /** The tray's Sign out, already confirmed, which presses Log out. */
    onTraySignOut: (listener: () => void): void => {
      ipcRenderer.on("tray:signOut", () => listener());
    },
    onTrackingNotice: (listener: (notice: string | null) => void): void => {
      ipcRenderer.on("tracking:notice", (_event, notice: string | null) =>
        listener(notice),
      );
    },
    onTrackingReminder: (
      listener: (reminder: TrackingReminder) => void,
    ): void => {
      ipcRenderer.on("tracking:reminder", (_event, reminder: TrackingReminder) =>
        listener(reminder),
      );
    },
    onReopened: (listener: () => void): void => {
      ipcRenderer.on("window:reopened", () => listener());
    },
    onCloseRequested: (listener: () => void): void => {
      ipcRenderer.on("window:closeRequested", () => listener());
    },
    /** null cancels: the window stays as it is. */
    answerClose: (
      action: "minimize" | "quit" | null,
      remember: boolean,
    ): Promise<void> =>
      ipcRenderer.invoke("window:answerClose", action, remember) as Promise<void>,
  },
  setup: {
    browserRestartPrompt: (): Promise<BrowserRestartPrompt> =>
      ipcRenderer.invoke(
        "setup:browserRestartPrompt",
      ) as Promise<BrowserRestartPrompt>,
    continueFromBrowserRestart: (): Promise<void> =>
      ipcRenderer.invoke("setup:continueFromBrowserRestart") as Promise<void>,
  },
  update: {
    status: (): Promise<UpdateCheckResult> =>
      ipcRenderer.invoke("update:status") as Promise<UpdateCheckResult>,
    openReleasesPage: (): Promise<void> =>
      ipcRenderer.invoke("update:openReleasesPage") as Promise<void>,
    autoStatus: (): Promise<AutoUpdateState> =>
      ipcRenderer.invoke("update:autoStatus") as Promise<AutoUpdateState>,
    restart: (): Promise<void> =>
      ipcRenderer.invoke("update:restart") as Promise<void>,
  },
};

contextBridge.exposeInMainWorld("api", api);

export type DesktopApi = typeof api;
