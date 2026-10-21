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
 * How long the agent will act on settings it has not been able to confirm.
 * Tracking time has no such limit — somebody genuinely away from a
 * connection for weeks should still get their hours — but capture does,
 * and the two are not the same promise. The settings say whether this
 * person's screen may be photographed, and an admin who switches that off
 * is owed an upper bound on how long a machine that never heard them
 * keeps going. A week covers a holiday or a bad stretch of internet;
 * past it, capture stops and says so. See docs/adr/0025-...
 */
export const CAPTURE_TRUST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * How long after the agent was last known to be alive a recovered timer is
 * still worth asking about. Past it the gap is too big to be plausibly
 * "the app crashed and I restarted it", and the time is dropped rather
 * than offered — matching Hubstaff's own one-hour rule, which is a
 * published default rather than a number invented here.
 */
export const CRASH_RECOVERY_WINDOW_MS = 60 * 60 * 1000;

/** Totals for one local day, so a new day starts from zero rather than yesterday. */
export interface CachedToday {
  /** `YYYY-MM-DD`, in the device's own time zone. */
  day: string;
  workedSeconds: number;
  deviceSeconds: number;
  projects: { projectId: string; seconds: number }[];
}

/**
 * The last answer the server gave to each thing the agent has to know to
 * be useful. Everything here is a copy of something the server owns — the
 * agent never decides any of it, it only remembers (see docs/adr/0025-...).
 */
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
  /**
   * The last `workedSeconds` the server reported, and when. Offline the
   * clock carries this forward rather than restarting from zero — the
   * figure cannot be confirmed, but it is far closer to the truth than
   * nothing, which is what used to be shown.
   */
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
 * What the agent knows when nobody can tell it anything.
 *
 * Until this existed the app kept its entire picture of the organisation
 * in renderer memory and asked the server for it again on every launch —
 * so with no connection it reached the logged-in screen, failed its first
 * request, and stopped setting itself up. No projects, no clock, and a
 * play button that silently did nothing. Everything it needs to keep
 * working is written down here as it arrives.
 *
 * Deliberately a plain JSON file rather than a row in `offline-queue.db`:
 * that queue is a list of things waiting to be *sent*, drained and
 * deleted as they land, and this is the opposite — the last thing
 * *received*, overwritten in place and never drained. Putting both in one
 * store would blur a distinction worth keeping. Unencrypted, unlike the
 * session: project names are on screen all day, and the file holds no
 * credential.
 *
 * Tied to a `deviceId`, so re-pairing as somebody else never shows the
 * previous person's projects — a different id reads as an empty cache
 * rather than as somebody else's.
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
      // Field by field: a file written by an older build has fewer keys,
      // and a missing one must read as "not known" rather than reach a
      // caller as undefined.
      this.state = { ...emptyState(), ...parsed, tasks: parsed.tasks ?? {} };
    } catch {
      // A truncated or hand-edited file means starting over, which costs
      // one online launch. Throwing here would strand the app with no
      // window at all — the same reasoning as setup-state.ts.
      this.state = emptyState();
    }
    return this.state;
  }

  /**
   * The cache, but only if it belongs to `deviceId`. Anything else is
   * discarded first: this is a new pairing, and the old answers are not
   * about this account.
   */
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

  /**
   * Totals stamped with the day they describe. Read back only on the same
   * day — see `todayTotals`.
   */
  rememberToday(totals: Omit<CachedToday, 'day'>): void {
    this.remember({ today: { ...totals, day: localDay(this.now()) } });
  }

  /**
   * Yesterday's totals are not today's. Returning them would show someone
   * opening the app offline on a new morning the hours they worked
   * yesterday, which is worse than showing nothing.
   */
  todayTotals(): CachedToday | null {
    const today = this.read().today;
    return today?.day === localDay(this.now()) ? today : null;
  }

  /**
   * Folds a stretch finished with no connection into the day's totals.
   *
   * `rememberToday` only ever writes what the server reported, so an hour
   * worked offline was invisible to it. Within one session that did not
   * show, because the renderer keeps its own running tally — but the
   * machine being switched off and turned on again is not one session,
   * and the day came back reading as though that hour had never been
   * worked. Which is the moment somebody decides the app lost their time.
   *
   * Additive on purpose. The hours are still queued and will be replayed;
   * when they land, the server's own total overwrites this, so a figure
   * counted here cannot survive as a double count.
   */
  addWorkedSeconds(projectId: string | null, seconds: number): void {
    if (seconds <= 0) return;
    // `todayTotals` withholds a stamp that is not today's, so a stretch
    // finished after midnight starts the new day rather than inflating
    // the old one.
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
    const since = this.now().getTime() - new Date(last).getTime();
    // A clock moved backwards would otherwise read as "heard from in the
    // future", which must not be treated as fresher than fresh.
    return Math.max(0, since);
  }

  /**
   * Whether capture may still act on settings this old. `true` before the
   * first contact ever: an agent that has never reached the server has no
   * settings to act on, so nothing is being trusted too long.
   */
  captureTrustExpired(): boolean {
    const silent = this.silentForMs();
    return silent === null || silent > CAPTURE_TRUST_WINDOW_MS;
  }

  /**
   * Whether capture stopped because settings it *had* went stale — as
   * opposed to never having had any.
   *
   * Only the first is worth telling anybody about. An agent that has not
   * reached the server yet is also not capturing, but that is a few
   * seconds at startup before the first poll lands, and announcing it
   * would put "paused until Hi Day can be reached" on screen every single
   * launch, next to a status line reading "Synced just now".
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
      // A full or read-only disk must not take the app down with it. The
      // in-memory copy still serves this session; only a restart loses it.
    }
  }
}
