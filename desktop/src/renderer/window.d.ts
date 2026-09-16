// Shared ambient declarations for every renderer entry point. They compile
// together into one global scope, so Window.api needs a single full
// definition rather than a partial one per file. `export {}` makes this a
// module, which is why everything sits inside `declare global`.

export {};

declare global {
  interface AuthStatus {
    loggedIn: boolean;
    email?: string;
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
    status: 'open' | 'closed';
  }

  interface TimeEntry {
    id: string;
    projectId: string;
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

  interface TrackedEntry {
    id: string;
    projectId: string;
    durationSeconds: number | null;
  }

  interface CurrentTimer {
    entry: TimeEntry | null;
    now: string;
  }

  type IdleHandling = 'off' | 'flag' | 'auto_subtract';

  interface IdlePolicy {
    handling: IdleHandling;
    thresholdMinutes: number;
  }

  type DesktopDevicePlatformName = 'windows' | 'macos' | 'linux';

  interface CapturePermissionStatus {
    windowTrackingEnabled: boolean;
    screenshotsEnabled: boolean;
    platform: DesktopDevicePlatformName;
    screenRecordingGranted: boolean;
    waylandUnsupported: boolean;
  }

  interface StartPairingResult {
    ok: boolean;
    message?: string;
  }

  type PairingPollResult =
    | { status: 'pending' }
    | { status: 'approved'; email: string; organisationName: string }
    | { status: 'expired' }
    | { status: 'error'; message: string };

  interface UpdateCheckResult {
    updateAvailable: boolean;
    latestVersion?: string;
  }

  type TrackingResult<T> =
    | { ok: true; data: T }
    | { ok: false; message: string; runningEntry?: TimeEntry; unauthorized?: boolean };

  /** See docs/adr/0015-.... */
  type ConsentDecision = 'granted' | 'declined';

  interface ConsentStatus {
    required: boolean;
    /** `null` when there's nothing to show (no capture enabled, or none published yet). */
    disclosureVersionId: string | null;
    text: string | null;
  }

  interface TrackingIndicatorStatus {
    active: boolean;
  }

  interface Window {
    api: {
      getStatus: () => Promise<AuthStatus>;
      auth: {
        startPairing: () => Promise<StartPairingResult>;
        pairingStatus: () => Promise<PairingPollResult>;
      };
      logout: () => Promise<AuthStatus>;
      tracking: {
        listProjects: () => Promise<TrackingResult<TrackedProject[]>>;
        listTasks: (projectId: string) => Promise<TrackingResult<{ tasks: TrackedTask[] }>>;
        start: (projectId: string, taskId: string | null) => Promise<TrackingResult<TimeEntry>>;
        switchTo: (projectId: string, taskId: string | null) => Promise<TrackingResult<TimeEntry>>;
        stop: (endedAt?: string) => Promise<TrackingResult<TimeEntry>>;
        status: () => Promise<TrackingResult<CurrentTimer>>;
        pause: () => Promise<TrackingResult<TimeEntry>>;
        resume: () => Promise<TrackingResult<TimeEntry>>;
        lastProject: () => Promise<LastProject | null>;
        entriesBetween: (from: string, to: string) => Promise<TrackingResult<TrackedEntry[]>>;
        idlePolicy: () => Promise<TrackingResult<IdlePolicy>>;
        permissionStatus: () => Promise<TrackingResult<CapturePermissionStatus>>;
        requestScreenRecordingAccess: () => Promise<void>;
        openScreenRecordingSettings: () => Promise<void>;
        indicatorStatus: () => Promise<TrackingIndicatorStatus>;
      };
      consent: {
        get: () => Promise<TrackingResult<ConsentStatus>>;
        submit: (
          disclosureVersionId: string,
          decision: ConsentDecision,
        ) => Promise<TrackingResult<void>>;
      };
      idle: {
        seconds: () => Promise<number>;
      };
      urlCapture: {
        timerStateChanged: (running: boolean) => void;
      };
      update: {
        status: () => Promise<UpdateCheckResult>;
        openReleasesPage: () => Promise<void>;
      };
    };
  }
}
