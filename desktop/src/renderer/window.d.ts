// Shared ambient declarations for every renderer entry point. They compile
// together into one global scope, so Window.api needs a single full
// definition rather than a partial one per file. `export {}` makes this a
// module, which is why everything sits inside `declare global`.

export {};

declare global {
  interface AuthStatus {
    loggedIn: boolean;
    email?: string;
    name?: string;
    organisationName?: string;
    message?: string;
  }

  interface TrackedProject {
    id: string;
    name: string;
    colour: string;
    client: string | null;
  }

  interface TrackedTask {
    id: string;
    name: string;
    description: string | null;
    status: 'open' | 'closed';
    createdAt: string;
    updatedAt: string;
  }

  interface TimeEntry {
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

  interface LastProject {
    projectId: string;
    taskId: string | null;
  }

  interface CompletedTotals {
    workedSeconds: number;
    /** This device's own entries alone, on the same baseline. */
    deviceSeconds: number;
    projects: { projectId: string; seconds: number }[];
  }

  interface TrackedEntry {
    id: string;
    projectId: string | null;
    durationSeconds: number | null;
  }

  interface CurrentTimer {
    entry: TimeEntry | null;
    now: string;
    /**
   * The person's worked seconds across every device currently tracking,
   * counting wall-clock time two devices share only once. Displayed instead
   * of this device's own elapsed time, so a machine joining a timer already
   * running elsewhere shows the total already accrued (ADR-0022).
   */
    workedSeconds: number;
    limitReached?: { kind: "daily" | "weekly"; limitHours: number };
  }

  type IdleHandling = 'off' | 'flag' | 'auto_subtract';

  interface IdlePolicy {
    handling: IdleHandling;
    thresholdMinutes: number;
  }

  type DesktopDevicePlatformName = 'windows' | 'macos' | 'linux';

  interface CapturePermissionStatus {
    windowTrackingEnabled: boolean;
    /** What "Track apps & URLs" resolves to for this person. */
    appUrlTracking: "off" | "apps" | "apps_urls";
    screenshotsEnabled: boolean;
    platform: DesktopDevicePlatformName;
    screenRecordingGranted: boolean;
    /** macOS + Firefox only — the AX helper that reads Firefox's address bar. */
    accessibilityGranted: boolean;
    /** Sent from main so permission-copy.ts stays the single source of wording. */
    accessibilityGuidance: string;
    waylandUnsupported: boolean;
  }

  interface StartPairingResult {
    ok: boolean;
    message?: string;
  }

  type PairingPollResult =
    | { status: 'pending' }
    | { status: 'approved'; email: string; name: string; organisationName: string }
    | { status: 'expired' }
    | { status: 'error'; message: string };

  interface BrowserRestartPrompt {
    show: boolean;
    names: string[];
    manual: { name: string; reason: string }[];
    warnings: string[];
  }

  interface UpdateCheckResult {
    updateAvailable: boolean;
    latestVersion?: string;
  }

  type AutoUpdatePhase = 'idle' | 'checking' | 'downloading' | 'downloaded' | 'unsupported';

  interface AutoUpdateState {
    phase: AutoUpdatePhase;
    latestVersion?: string;
    progressPercent?: number;
  }

  type TrackingResult<T> =
    | {
        ok: true;
        data: T;
        /**
         * Answered from what the main process remembered, not from the
         * server — the data is the last that was true, not the current
         * truth. Drives the "Can't reach Hi Day" line.
         */
        fromCache?: boolean;
      }
    | {
        ok: false;
        message: string;
        runningEntry?: TimeEntry;
        unauthorized?: boolean;
        /** HTTP status; absent when the server could not be reached. */
        status?: number;
      };

  interface Window {
    api: {
      getStatus: () => Promise<AuthStatus>;
      auth: {
        startPairing: () => Promise<StartPairingResult>;
        pairingStatus: () => Promise<PairingPollResult>;
      };
      logout: () => Promise<AuthStatus>;
      tracking: {
        projectsSetting: () => Promise<TrackingResult<{ projectsEnabled: boolean }>>;
        listProjects: () => Promise<TrackingResult<TrackedProject[]>>;
        listTasks: (projectId: string) => Promise<TrackingResult<{ tasks: TrackedTask[] }>>;
        start: (
          projectId: string | null,
          taskId: string | null,
          startedAt?: string,
        ) => Promise<TrackingResult<TimeEntry>>;
        switchTo: (projectId: string | null, taskId: string | null) => Promise<TrackingResult<TimeEntry>>;
        stop: (endedAt?: string) => Promise<TrackingResult<TimeEntry>>;
        status: () => Promise<TrackingResult<CurrentTimer>>;
        pause: () => Promise<TrackingResult<TimeEntry>>;
        resume: () => Promise<TrackingResult<TimeEntry>>;
        syncBacklog: () => Promise<string | null>;
        capturePaused: () => Promise<boolean>;
        recoveredTimer: () => Promise<{
          startedAt: string;
          lastSeenAt: string;
          silentForMs: number;
        } | null>;
        answerRecoveredTimer: (keep: boolean) => Promise<void>;
        lastProject: () => Promise<LastProject | null>;
        entriesBetween: (from: string, to: string) => Promise<TrackingResult<TrackedEntry[]>>;
        completedTotals: (from: string, to: string) => Promise<TrackingResult<CompletedTotals>>;
        idlePolicy: () => Promise<TrackingResult<IdlePolicy>>;
        permissionStatus: () => Promise<TrackingResult<CapturePermissionStatus>>;
        requestScreenRecordingAccess: () => Promise<void>;
        openPrivacySettings: (
          pane: 'accessibility' | 'screenRecording',
        ) => Promise<void>;
      };
      idle: {
        seconds: () => Promise<number>;
      };
      urlCapture: {
        timerStateChanged: (running: boolean) => void;
      };
      trackingAlert: (body: string) => Promise<void>;
    windowControls: {
        minimise: () => Promise<void>;
        show: () => Promise<void>;
        close: () => Promise<void>;
        setMode: (
          mode: "full" | "compact" | "mini",
          centre?: boolean,
        ) => Promise<void>;
        /** Fires when the window comes back from being closed to the tray. */
        onRefusedTime: (
          listener: (
            refused: {
              op: { type: "start" | "stop"; at: string };
              message: string;
            }[],
          ) => void,
        ) => void;
        onSyncDraining: (
          listener: (
            progress: { remaining: number; secondsLeft: number } | null,
          ) => void,
        ) => void;
        closeSyncDraining: () => void;
        onSyncBacklog: (listener: (message: string | null) => void) => void;
        onCapturePaused: (listener: (paused: boolean) => void) => void;
        onTrayToggleTimer: (listener: () => void) => void;
        onTrayTrackProject: (listener: (projectId: string) => void) => void;
        onTraySignOut: (listener: () => void) => void;
        onTrackingNotice: (listener: (notice: string | null) => void) => void;
        onTrackingReminder: (
          listener: (reminder: {
            untrackedMinutes: number;
            signedOut: boolean;
            workingHoursPerDay: number;
          }) => void,
        ) => void;
        onReopened: (listener: () => void) => void;
        /** Main asks whether closing should minimise to the tray or quit. */
        onCloseRequested: (listener: () => void) => void;
        /** null cancels: the window stays as it is. */
        answerClose: (
          action: 'minimize' | 'quit' | null,
          remember: boolean,
        ) => Promise<void>;
      };
      setup: {
        browserRestartPrompt: () => Promise<BrowserRestartPrompt>;
        continueFromBrowserRestart: () => Promise<void>;
      };
      update: {
        status: () => Promise<UpdateCheckResult>;
        openReleasesPage: () => Promise<void>;
        autoStatus: () => Promise<AutoUpdateState>;
        restart: () => Promise<void>;
      };
    };
  }
}
