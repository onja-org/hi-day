import type { DesktopDevicePlatform } from './platform';
import type { ReminderSettings } from "./tracking-reminder";
import type { ActivitySample } from './activity-sampler';
import type { UrlSession } from './url-capture/session-types';
import type { SyncResponseBody } from './url-capture/sync-contract';
import type { TitleUnavailableReason } from './window-sample';

/**
 * Logging in is the one thing that genuinely cannot work offline — pairing
 * is a conversation with the server, and there is no cached answer for it.
 * So it is said plainly, without the server address: nobody reading the
 * login screen can do anything with a URL.
 */
/**
 * How long a device request waits before it counts as unreachable.
 *
 * Without a deadline `fetch` waits as long as the operating system lets
 * it, and the two ways of being offline fail very differently: a refused
 * connection (nothing listening on the port) rejects at once, while a
 * network that has simply gone — wifi dropped, router dead, a captive
 * portal swallowing traffic — never refuses anything, so the socket sits
 * waiting for a reply that is not coming. That is the one a real user
 * gets, and it can take minutes.
 *
 * It matters because the cached answer only arrives once the request
 * returns: without this, "works offline" means "works offline, a minute
 * or two from now", with the app looking as broken as it ever did in the
 * meantime. The polls run on a 15s cycle, so five seconds fails well
 * inside one, and no honest request to this API takes that long.
 *
 * Pairing is deliberately excluded — logging in is something a person
 * just asked for and is waiting on, and there is no cached answer to fall
 * back to anyway.
 */
export const REQUEST_TIMEOUT_MS = 5_000;

const OFFLINE_LOGIN_MESSAGE =
  "Hi Day can't be reached. Logging in needs an internet connection.";

export interface StartPairingRequest {
  deviceFingerprint: string;
  platform: DesktopDevicePlatform;
  osVersion: string;
  hostname: string;
  appVersion: string;
}

export type StartPairingResult =
  | { ok: true; code: string; approvalUrl: string }
  | { ok: false; message: string };

export type PairingPollResult =
  | { status: 'pending' }
  | {
      status: 'approved';
      deviceId: string;
      deviceToken: string;
      email: string;
      name: string;
      organisationName: string;
    }
  | { status: 'expired' }
  | { status: 'error'; message: string };

interface StartPairingResponseBody {
  message?: string;
  code?: string;
  approvalUrl?: string;
}

interface PairingPollResponseBody {
  status?: 'pending' | 'approved' | 'expired';
  deviceId?: string;
  deviceToken?: string;
  email?: string;
  name?: string;
  organisationName?: string;
}

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
  status: 'open' | 'closed';
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
  /** Non-null while the entry has an open pause span — see the pause/resume ADR. */
  pausedAt: string | null;
  /** Total seconds paused so far, across every *closed* pause span. */
  pausedSeconds: number;
}

/** One completed/running entry as the agent needs it — just enough to total by Project. */
/** Time worked beyond what the open entries cover; the live clock adds those. */
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

export interface CurrentTimer {
  entry: TimeEntry | null;
  now: string;
  /**
   * The person's worked seconds across every device currently tracking,
   * counting wall-clock time two devices share only once (ADR-0022).
   * Optional here because an older server does not send it, and because
   * the offline fallback projects it forward rather than knowing it.
   */
  workedSeconds?: number;
  limitReached?: { kind: 'daily' | 'weekly'; limitHours: number };
}

export type IdleHandling = 'off' | 'flag' | 'auto_subtract';

export type AppUrlTracking = "off" | "apps" | "apps_urls";

export type AllowedApps = "all" | "desktop_only" | "mobile_only";

export interface IdlePolicy {
  handling: IdleHandling;
  thresholdMinutes: number;
}

export interface CaptureSettings {
  windowTrackingEnabled: boolean;
  /** The organisation default with this member's override applied. */
  appUrlTracking: AppUrlTracking;
  /** Likewise resolved. */
  allowedApps: AllowedApps;
  screenshotsEnabled: boolean;
  screenshotFrequencySeconds: number;
  screenshotRetentionDays: number;
  /** See docs/adr/0015-... — whether the passive disclosure banner should be shown. Informational only; never gates capture. */
  consent: { required: boolean };
  /** When to nudge someone who has not started their timer. */
  reminders: ReminderSettings;
}

/**
 * The wire shape for `POST /device/app-events` — deliberately omits
 * `title`/`titleUnavailableReason` when absent (`undefined`) rather than
 * sending an explicit `null`, matching the backend DTO's `@IsOptional()`
 * fields.
 */
export interface AppEventPayload {
  appName: string;
  title?: string;
  titleUnavailableReason?: TitleUnavailableReason;
  sampledAt: string;
}

export type TrackingResult<T> =
  | {
      ok: true;
      data: T;
      /**
       * The server did not answer this; the last answer it gave did. Set
       * only by the main process's cached reads, so the renderer can show
       * the figures as remembered rather than current.
       */
      fromCache?: boolean;
    }
  | {
      ok: false;
      message: string;
      runningEntry?: TimeEntry;
      unauthorized?: boolean;
      /**
       * The HTTP status, when the request actually reached the server.
       * Absent for a transport failure (server unreachable, DNS, TLS).
       * Lets a caller tell "the server rejected this and always will"
       * (4xx) apart from "try again later" — a distinction that matters
       * for anything on a retry loop, since a permanently-rejected
       * payload otherwise retries silently forever.
       */
      status?: number;
    };

/**
 * Whether the request never reached the server at all — no HTTP status,
 * so nothing was accepted, rejected or decided. The one condition under
 * which a cached answer may stand in, and under which a queued operation
 * is worth replaying later: a refusal is an answer, and repeating it
 * changes nothing.
 */
export function isTransportFailure<T>(result: TrackingResult<T>): boolean {
  return !result.ok && result.status === undefined && !result.unauthorized;
}

interface ErrorResponseBody {
  message?: string[] | string;
  runningEntry?: TimeEntry;
}

/**
 * Talks to the backend from the Electron *main* process, not the renderer.
 * The renderer's origin is file:// (or app://), which CORS_ORIGIN doesn't
 * allow — a fetch from the renderer would be blocked. Main-process requests
 * aren't subject to CORS.
 */
export class ApiClient {
  /**
   * `isOffline` lets a developer put the agent behind a wall without
   * unplugging anything — see `offlineSimulated` in tuning.ts. It sits
   * here, in front of every `fetch`, rather than in any one caller,
   * because that is the only place that reproduces the real shape of
   * being offline: a transport failure, with no HTTP status, on every
   * request alike. The offline cases worth testing (a week-stale capture
   * setting, hours replayed and refused, a crash mid-outage) are
   * otherwise painful to reach by hand.
   */
  constructor(
    private readonly baseUrl: string,
    private readonly isOffline: () => boolean = () => false,
  ) {}

  /** The shape a request that never reached the server resolves to. */
  private unreachable<T>(): TrackingResult<T> {
    return { ok: false, message: `Could not reach the server at ${this.baseUrl}.` };
  }

  /**
   * Starts the "log in via the web app" pairing flow (ADR-0009) — the
   * desktop never handles a password itself. The caller opens `approvalUrl`
   * in the system browser and polls `pollPairing` with the returned code.
   */
  async startPairing(request: StartPairingRequest): Promise<StartPairingResult> {
    if (this.isOffline()) return { ok: false, message: OFFLINE_LOGIN_MESSAGE };
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/device-pairing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
    } catch {
      return { ok: false, message: OFFLINE_LOGIN_MESSAGE };
    }

    const body = (await response.json().catch(() => ({}))) as StartPairingResponseBody;

    if (!response.ok || !body.code || !body.approvalUrl) {
      return { ok: false, message: body.message ?? 'Could not start login.' };
    }

    return { ok: true, code: body.code, approvalUrl: body.approvalUrl };
  }

  async pollPairing(code: string): Promise<PairingPollResult> {
    if (this.isOffline()) {
      return { status: 'error', message: OFFLINE_LOGIN_MESSAGE };
    }
    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/device-pairing/${encodeURIComponent(code)}/status`,
      );
    } catch {
      return { status: 'error', message: OFFLINE_LOGIN_MESSAGE };
    }

    const body = (await response.json().catch(() => ({}))) as PairingPollResponseBody;

    if (!response.ok || !body.status) {
      return { status: 'error', message: 'Could not check login status.' };
    }

    if (body.status === 'approved') {
      if (
        !body.deviceId ||
        !body.deviceToken ||
        !body.email ||
        !body.name ||
        !body.organisationName
      ) {
        return { status: 'error', message: 'Could not finish logging in.' };
      }
      return {
        status: 'approved',
        deviceId: body.deviceId,
        deviceToken: body.deviceToken,
        email: body.email,
        name: body.name,
        organisationName: body.organisationName,
      };
    }

    return { status: body.status };
  }

  async logout(deviceToken: string): Promise<void> {
    if (this.isOffline()) return;
    try {
      await fetch(`${this.baseUrl}/devices/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${deviceToken}` },
      });
    } catch {
      // Best-effort: if the server is unreachable, the session is left to
      // expire naturally rather than blocking the user from logging out
      // locally.
    }
  }

  /**
   * Keeps `lastSeenAt` fresh so the Devices page's active/offline status
   * reflects a running app, not just a login. Best-effort: a missed
   * heartbeat shows this device offline until the next one lands.
   */
  async heartbeat(deviceToken: string, appVersion: string): Promise<boolean> {
    if (this.isOffline()) return false;
    try {
      const response = await fetch(`${this.baseUrl}/devices/heartbeat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${deviceToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ appVersion }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /** Whether to offer a Project picker, or just a timer. */
  getProjectsSetting(
    deviceToken: string,
  ): Promise<TrackingResult<{ projectsEnabled: boolean }>> {
    return this.deviceRequest('GET', '/device/projects-setting', deviceToken);
  }

  listProjects(deviceToken: string): Promise<TrackingResult<TrackedProject[]>> {
    return this.deviceRequest('GET', '/device/projects', deviceToken);
  }

  listTasks(
    deviceToken: string,
    projectId: string,
  ): Promise<TrackingResult<{ tasks: TrackedTask[] }>> {
    return this.deviceRequest(
      'GET',
      `/device/projects/${projectId}/tasks`,
      deviceToken,
    );
  }

  startTimer(
    deviceToken: string,
    /** null when the organisation doesn't track time against Projects. */
    projectId: string | null,
    taskId: string | null,
    /** When start was really pressed, for a start made while offline. */
    startedAt?: string,
    /** This agent's id for the operation, so a replay is not a second start. */
    opId?: string,
  ): Promise<TrackingResult<TimeEntry>> {
    return this.deviceRequest(
      'POST',
      projectId === null
        ? '/device/time-entries/start'
        : `/device/projects/${projectId}/time-entries/start`,
      deviceToken,
      {
        ...(taskId ? { taskId } : {}),
        ...(startedAt ? { startedAt } : {}),
        ...(opId ? { opId } : {}),
      },
    );
  }

  switchTimer(
    deviceToken: string,
    projectId: string | null,
    taskId: string | null,
  ): Promise<TrackingResult<TimeEntry>> {
    return this.deviceRequest('POST', '/device/time-entries/switch', deviceToken, {
      ...(projectId ? { projectId } : {}),
      ...(taskId ? { taskId } : {}),
    });
  }

  /**
   * `endedAt`, when given, backdates the stop instead of using "now" — the
   * idle-discard flow uses this to end the entry at when the person
   * actually went idle, not when the agent/person acted on the prompt.
   */
  stopTimer(
    deviceToken: string,
    endedAt?: string,
    /** This agent's id for the operation, so a replay is not a second stop. */
    opId?: string,
  ): Promise<TrackingResult<TimeEntry>> {
    return this.deviceRequest('POST', '/device/time-entries/stop', deviceToken, {
      ...(endedAt ? { endedAt } : {}),
      ...(opId ? { opId } : {}),
    });
  }

  getCurrentTimer(deviceToken: string): Promise<TrackingResult<CurrentTimer>> {
    return this.deviceRequest('GET', '/device/time-entries/current', deviceToken);
  }

  pauseTimer(deviceToken: string): Promise<TrackingResult<TimeEntry>> {
    return this.deviceRequest('POST', '/device/time-entries/pause', deviceToken, {});
  }

  resumeTimer(deviceToken: string): Promise<TrackingResult<TimeEntry>> {
    return this.deviceRequest('POST', '/device/time-entries/resume', deviceToken, {});
  }

  syncUrlSessions(
    deviceToken: string,
    sessions: UrlSession[],
  ): Promise<TrackingResult<SyncResponseBody>> {
    return this.deviceRequest('POST', '/device/url-sessions/sync', deviceToken, {
      sessions,
    });
  }

  listEntriesBetween(
    deviceToken: string,
    from: string,
    to: string,
  ): Promise<TrackingResult<TrackedEntry[]>> {
    const query = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    return this.deviceRequest('GET', `/device/time-entries${query}`, deviceToken);
  }

  getCompletedTotals(
    deviceToken: string,
    from: string,
    to: string,
  ): Promise<TrackingResult<CompletedTotals>> {
    const query = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    return this.deviceRequest('GET', `/device/time-entries/totals${query}`, deviceToken);
  }

  postAppEvents(
    deviceToken: string,
    events: AppEventPayload[],
  ): Promise<TrackingResult<void>> {
    return this.deviceRequest('POST', '/device/app-events', deviceToken, {
      events,
    });
  }

  postActivitySamples(
    deviceToken: string,
    samples: ActivitySample[],
  ): Promise<TrackingResult<void>> {
    return this.deviceRequest('POST', '/device/activity-samples', deviceToken, {
      samples,
    });
  }

  getIdlePolicy(deviceToken: string): Promise<TrackingResult<IdlePolicy>> {
    return this.deviceRequest('GET', '/device/idle-policy', deviceToken);
  }

  getCaptureSettings(
    deviceToken: string,
  ): Promise<TrackingResult<CaptureSettings>> {
    return this.deviceRequest('GET', '/device/capture-settings', deviceToken);
  }

  requestScreenshotUploadUrl(
    deviceToken: string,
    capturedAt: string,
  ): Promise<TrackingResult<{ uploadUrl: string; storageKey: string }>> {
    return this.deviceRequest(
      'POST',
      '/device/screenshots/upload-url',
      deviceToken,
      { capturedAt },
    );
  }

  recordScreenshot(
    deviceToken: string,
    storageKey: string,
    capturedAt: string,
  ): Promise<TrackingResult<void>> {
    return this.deviceRequest('POST', '/device/screenshots', deviceToken, {
      storageKey,
      capturedAt,
    });
  }

  /**
   * A raw PUT straight to the presigned Wasabi URL — deliberately not
   * routed through `deviceRequest`, since this isn't a `/device/...` call
   * (no bearer token, no JSON body, no backend involved at all once the
   * URL has been issued — see docs/adr/0012-...).
   */
  async putScreenshot(uploadUrl: string, buffer: Buffer): Promise<boolean> {
    if (this.isOffline()) return false;
    try {
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        // A plain Uint8Array, not the Node `Buffer` subclass — TS's DOM
        // `BodyInit` type doesn't resolve `Buffer<ArrayBufferLike>` against
        // its overloads even though Buffer *is* structurally a Uint8Array.
        body: new Uint8Array(buffer),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async deviceRequest<T>(
    method: 'GET' | 'POST',
    path: string,
    deviceToken: string,
    body?: unknown,
  ): Promise<TrackingResult<T>> {
    if (this.isOffline()) return this.unreachable();
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${deviceToken}`,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        // An abort lands in the same `catch` as any other transport
        // failure, which is exactly right: nothing reached the server, so
        // there is no status and the cache may answer.
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      // No `status`: the request never reached the server, so there is no
      // HTTP result to classify — always worth retrying.
      return { ok: false, message: `Could not reach the server at ${this.baseUrl}.` };
    }

    if (response.ok) {
      const data = (await response.json().catch(() => ({}))) as T;
      return { ok: true, data };
    }

    const errorBody = (await response.json().catch(() => ({}))) as ErrorResponseBody;
    const message = Array.isArray(errorBody.message)
      ? errorBody.message[0]
      : errorBody.message;
    return {
      ok: false,
      message: message ?? 'Something went wrong. Please try again.',
      runningEntry: errorBody.runningEntry,
      // DeviceSessionGuard returns exactly this status for a missing,
      // expired, or (the case this exists for) admin-revoked session —
      // never for a validation error or a genuinely transient failure, so
      // callers can safely treat this as "sign out locally right now"
      // rather than "retry next poll". Distinct from checking the message
      // string, which is just human-readable text, not a contract.
      unauthorized: response.status === 401,
      status: response.status,
    };
  }
}
