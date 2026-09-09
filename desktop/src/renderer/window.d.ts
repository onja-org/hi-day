// Shared ambient declarations for every renderer entry point (renderer.ts,
// coverage-renderer.ts) — tsconfig.renderer.json compiles them all
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

  type TrackingResult<T> =
    | { ok: true; data: T }
    | { ok: false; message: string; runningEntry?: TimeEntry; unauthorized?: boolean };

  type CoverageStatus = 'active' | 'degraded' | 'off';

  interface BrowserCoverageRow {
    key: string;
    installed: boolean;
    status: CoverageStatus;
    reason: string;
    confidence?: 'exact' | 'displayed' | 'guess';
    approximateNote?: string;
  }

  interface CoverageReport {
    platform: string;
    generatedAt: number;
    resolverHealth: {
      state: 'starting' | 'ready' | 'restarting' | 'degraded';
      lastReadyAt: number | null;
      lastSuccessfulResolveAt: number | null;
      recentErrorCounts: Record<string, number>;
    };
    browsers: BrowserCoverageRow[];
  }

  interface Window {
    api: {
      getStatus: () => Promise<AuthStatus>;
      login: (email: string, password: string) => Promise<AuthStatus>;
      logout: () => Promise<AuthStatus>;
      tracking: {
        listProjects: () => Promise<TrackingResult<TrackedProject[]>>;
        listTasks: (projectId: string) => Promise<TrackingResult<{ tasks: TrackedTask[] }>>;
        start: (projectId: string, taskId: string | null) => Promise<TrackingResult<TimeEntry>>;
        switchTo: (projectId: string, taskId: string | null) => Promise<TrackingResult<TimeEntry>>;
        stop: (endedAt?: string) => Promise<TrackingResult<TimeEntry>>;
        status: () => Promise<TrackingResult<CurrentTimer>>;
        idlePolicy: () => Promise<TrackingResult<IdlePolicy>>;
      };
      idle: {
        seconds: () => Promise<number>;
      };
      urlCapture: {
        timerStateChanged: (running: boolean) => void;
      };
      coverage: {
        get: () => Promise<CoverageReport | null>;
        openWindow: () => void;
      };
    };
  }
}
