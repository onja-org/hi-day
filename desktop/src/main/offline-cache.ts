import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CaptureSettingsValue } from './capture-settings-gate';
import type {
  IdlePolicy,
  TimeEntry,
  TrackedProject,
  TrackedTask,
} from './api-client';

const FILE_NAME = 'offline-cache.json';

/**
 * How long capture may act on settings it cannot confirm. Tracking time
 * has no such limit — somebody away from a connection for weeks should
 * still get their hours — but these settings say whether a person's
 * screen may be photographed, and an admin who switches that off is owed
 * an upper bound. See docs/adr/0025-...
 */
export const CAPTURE_TRUST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Totals for one local day, so a new day starts from zero rather than yesterday. */
export interface CachedToday {
  /** `YYYY-MM-DD`, in the device's own time zone. */
  day: string;
  workedSeconds: number;
  deviceSeconds: number;
  projects: { projectId: string; seconds: number }[];
}

/** The last answer the server gave to everything the agent needs. */
export interface OfflineCacheState {
  /** Whose answers these are. A different device's are not this one's to show. */
  deviceId: string | null;
  /** When the server last answered anything at all. */
  lastContactAt: string | null;
  projectsEnabled: boolean | null;
  projects: TrackedProject[] | null;
  /** Keyed by Project — in practice only the one the timer last ran against. */
  tasks: Record<string, TrackedTask[]>;
  captureSettings: CaptureSettingsValue | null;
  idlePolicy: IdlePolicy | null;
  /** The entry believed to be running, so a restart offline can still stop it. */
  runningEntry: TimeEntry | null;
  /** When that entry was last known to be running — the crash prompt's anchor. */
  runningSeenAt: string | null;
  /** The last `workedSeconds` reported, carried forward offline rather than reset to zero. */
  workedSeconds: number | null;
  workedSecondsAt: string | null;
  today: CachedToday | null;
}

function emptyState(): OfflineCacheState {
  return {
    deviceId: null,
    lastContactAt: null,
    projectsEnabled: null,
    projects: null,
    tasks: {},
    captureSettings: null,
    idlePolicy: null,
    runningEntry: null,
    runningSeenAt: null,
    workedSeconds: null,
    workedSecondsAt: null,
    today: null,
  };
}

/** `YYYY-MM-DD` for `at` in the machine's own time zone, never UTC. */
export function localDay(at: Date): string {
  const month = String(at.getMonth() + 1).padStart(2, '0');
  const day = String(at.getDate()).padStart(2, '0');
  return `${at.getFullYear()}-${month}-${day}`;
}

/**
 * What the agent knows when nobody can tell it anything. Without it the
 * app reached the logged-in screen, failed its first request and stopped
 * setting itself up: no projects, no clock, and a play button that did
 * nothing (docs/adr/0025-...).
 *
 * A plain JSON file rather than a row in `offline-queue.db`: that queue
 * holds things waiting to be *sent*, drained as they land; this is the
 * last thing *received*, overwritten in place. Unencrypted, since project
 * names are on screen all day and it holds no credential. Tied to a
 * `deviceId`, so re-pairing as somebody else reads as an empty cache.
 */
export class OfflineCache {
  private state: OfflineCacheState | null = null;

  constructor(
    private readonly userDataDir: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private get filePath(): string {
    return join(this.userDataDir, FILE_NAME);
  }

  /** The cache as it stands, or an empty one — never throws. */
  read(): OfflineCacheState {
    if (this.state) return this.state;
    try {
      if (!existsSync(this.filePath)) return (this.state = emptyState());
      const parsed = JSON.parse(
        readFileSync(this.filePath, 'utf-8'),
      ) as Partial<OfflineCacheState>;
      // Field by field: an older build's file has fewer keys, and a
      // missing one must read as "not known", not reach a caller as
      // undefined.
      this.state = { ...emptyState(), ...parsed, tasks: parsed.tasks ?? {} };
    } catch {
      // Starting over costs one online launch; throwing would strand the
      // app with no window at all (same reasoning as setup-state.ts).
      this.state = emptyState();
    }
    return this.state;
  }

  /** The cache, but only if it belongs to `deviceId`; anything else is discarded. */
  readFor(deviceId: string): OfflineCacheState {
    const state = this.read();
    if (state.deviceId !== null && state.deviceId !== deviceId) {
      this.state = { ...emptyState(), deviceId };
      this.write();
      return this.state;
    }
    if (state.deviceId === null) this.remember({ deviceId });
    return this.read();
  }

  /** Merges `patch` into the cache and writes it. */
  remember(patch: Partial<OfflineCacheState>): void {
    this.state = { ...this.read(), ...patch };
    this.write();
  }

  /** Records that the server answered just now. */
  rememberContact(): void {
    this.remember({ lastContactAt: this.now().toISOString() });
  }

  /** The tasks for one Project, left alongside whatever other Project's are held. */
  rememberTasks(projectId: string, tasks: TrackedTask[]): void {
    this.remember({ tasks: { ...this.read().tasks, [projectId]: tasks } });
  }

  /** Totals stamped with the day they describe — see `todayTotals`. */
  rememberToday(totals: Omit<CachedToday, 'day'>): void {
    this.remember({ today: { ...totals, day: localDay(this.now()) } });
  }

  /**
   * Withholds a stamp that is not today's: yesterday's hours shown on a
   * new morning are worse than showing nothing.
   */
  todayTotals(): CachedToday | null {
    const today = this.read().today;
    return today?.day === localDay(this.now()) ? today : null;
  }

  /**
   * Folds a stretch finished with no connection into the day's totals.
   * `rememberToday` only writes what the server reported, so an hour
   * worked offline was invisible to it — which showed the moment the
   * machine was switched off and on again, as a day where it never
   * happened. Additive: when the queued hours land, the server's own
   * total overwrites this, so nothing here survives as a double count.
   */
  addWorkedSeconds(projectId: string | null, seconds: number): void {
    if (seconds <= 0) return;
    // A stretch finished after midnight starts the new day rather than
    // inflating the old one.
    const base = this.todayTotals() ?? {
      workedSeconds: 0,
      deviceSeconds: 0,
      projects: [],
    };
    const known = projectId !== null &&
      base.projects.some((project) => project.projectId === projectId);
    this.rememberToday({
      workedSeconds: base.workedSeconds + seconds,
      deviceSeconds: base.deviceSeconds + seconds,
      projects:
        projectId === null
          ? base.projects
          : known
            ? base.projects.map((project) =>
                project.projectId === projectId
                  ? { ...project, seconds: project.seconds + seconds }
                  : project,
              )
            : [...base.projects, { projectId, seconds }],
    });
  }

  /**
   * Records that the timer believed to be running still is. Crash
   * recovery measures its gap from `runningSeenAt`, so it has to mean
   * "the app was alive", a local fact — written only on a server answer,
   * an outage looked exactly like a crash and an hour of offline work was
   * ended where the connection dropped. A no-op when nothing is running,
   * which would resurrect an already-settled gap.
   */
  touchRunning(): void {
    if (!this.read().runningEntry) return;
    this.remember({ runningSeenAt: this.now().toISOString() });
  }

  /** Notes the entry believed to be running, and that it was alive just now. */
  rememberRunning(entry: TimeEntry | null): void {
    this.remember({
      runningEntry: entry,
      runningSeenAt: entry ? this.now().toISOString() : null,
    });
  }

  /** How long since the server last answered, or `null` if it never has. */
  silentForMs(): number | null {
    const last = this.read().lastContactAt;
    if (!last) return null;
    // Clamped: a backwards clock must not read as fresher than fresh.
    return Math.max(0, this.now().getTime() - new Date(last).getTime());
  }

  /** `true` before the first contact ever: no settings yet, so nothing to act on. */
  captureTrustExpired(): boolean {
    const silent = this.silentForMs();
    return silent === null || silent > CAPTURE_TRUST_WINDOW_MS;
  }

  /**
   * Whether settings it *had* went stale, as opposed to never having had
   * any — only the first is worth announcing. The second is the few
   * seconds before the first poll of every launch, and saying so put
   * "paused until Hi Day can be reached" next to "Synced just now".
   */
  captureTrustLapsed(): boolean {
    const silent = this.silentForMs();
    return silent !== null && silent > CAPTURE_TRUST_WINDOW_MS;
  }

  /** Forgets everything — a sign-out, so none of it is this machine's to keep. */
  clear(): void {
    this.state = emptyState();
    this.write();
  }

  private write(): void {
    try {
      mkdirSync(this.userDataDir, { recursive: true });
      writeFileSync(this.filePath, JSON.stringify(this.state), 'utf-8');
    } catch {
      // A full or read-only disk must not take the app down with it; the
      // in-memory copy still serves this session.
    }
  }
}
