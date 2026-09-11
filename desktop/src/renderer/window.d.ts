// Shared ambient declarations for every renderer entry point —
// tsconfig.renderer.json compiles them all
// together, so each entry point's own `declare global` block merges into
// the SAME global scope. TypeScript requires every declaration of `api`
// across that merge to agree on the exact same type, so there can only be
// one definition of the full Window.api shape, not one partial
// declaration per file that only mentions what that file uses. Everything
// here — not just Window — lives inside `declare global` (rather than as
// plain top-level interfaces) because this file ends in `export {}`,
// which makes it a module; a plain top-level interface in a module is
// scoped to that module, not visible as a bare global name the way the
// original single-entry-point renderer.ts relied on.

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
