import type { DesktopDevicePlatform } from './platform';
import type { UrlSession } from './url-capture/session-types';
import type { SyncResponseBody } from './url-capture/sync-contract';
import type { TitleUnavailableReason } from './window-sample';

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
  status: 'open' | 'closed';
}

export interface TimeEntry {
  id: string;
  projectId: string;
  taskId: string | null;
  startedAt: string;
  endedAt: string | null;
  /** Non-null while the entry has an open pause span — see the pause/resume ADR. */
  pausedAt: string | null;
  /** Total seconds paused so far, across every *closed* pause span. */
  pausedSeconds: number;
}

/** One completed/running entry as the agent needs it — just enough to total by Project. */
export interface TrackedEntry {
  id: string;
  projectId: string;
  durationSeconds: number | null;
}

export interface CurrentTimer {
  entry: TimeEntry | null;
  now: string;
}

export type IdleHandling = 'off' | 'flag' | 'auto_subtract';

export interface IdlePolicy {
  handling: IdleHandling;
  thresholdMinutes: number;
}

export interface CaptureSettings {
  windowTrackingEnabled: boolean;
  screenshotsEnabled: boolean;
  screenshotFrequencySeconds: number;
  screenshotRetentionDays: number;
  activityTrackingEnabled: boolean;
  /** See docs/adr/0015-... — whether the passive disclosure banner should be shown. Informational only; never gates capture. */
  consent: { required: boolean };
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

/** The wire shape for `POST /device/activity-samples` — one row per 10-minute period. */
export interface ActivitySamplePayload {
  activePercentage: number;
  periodStart: string;
  periodEnd: string;
}

export type TrackingResult<T> =
  | { ok: true; data: T }
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
  constructor(private readonly baseUrl: string) {}

  /**
   * Starts the "log in via the web app" pairing flow (ADR-0009) — the
   * desktop never handles a password itself. The caller opens `approvalUrl`
   * in the system browser and polls `pollPairing` with the returned code.
   */
  async startPairing(request: StartPairingRequest): Promise<StartPairingResult> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/device-pairing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
    } catch {
      return { ok: false, message: `Could not reach the server at ${this.baseUrl}.` };
    }

    const body = (await response.json().catch(() => ({}))) as StartPairingResponseBody;

    if (!response.ok || !body.code || !body.approvalUrl) {
      return { ok: false, message: body.message ?? 'Could not start login.' };
    }

    return { ok: true, code: body.code, approvalUrl: body.approvalUrl };
  }

  async pollPairing(code: string): Promise<PairingPollResult> {
    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/device-pairing/${encodeURIComponent(code)}/status`,
      );
    } catch {
      return { status: 'error', message: `Could not reach the server at ${this.baseUrl}.` };
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
        !body.organisationName
      ) {
        return { status: 'error', message: 'Could not finish logging in.' };
      }
      return {
        status: 'approved',
        deviceId: body.deviceId,
        deviceToken: body.deviceToken,
        email: body.email,
        organisationName: body.organisationName,
      };
    }

    return { status: body.status };
  }

  async logout(deviceToken: string): Promise<void> {
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
    try {
      const response = await fetch(`${this.baseUrl}/devices/heartbeat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${deviceToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ appVersion }),
      });
      return response.ok;
    } catch {
      return false;
    }
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
    projectId: string,
    taskId: string | null,
  ): Promise<TrackingResult<TimeEntry>> {
    return this.deviceRequest(
      'POST',
      `/device/projects/${projectId}/time-entries/start`,
      deviceToken,
      taskId ? { taskId } : {},
    );
  }

  switchTimer(
    deviceToken: string,
    projectId: string,
    taskId: string | null,
  ): Promise<TrackingResult<TimeEntry>> {
    return this.deviceRequest('POST', '/device/time-entries/switch', deviceToken, {
      projectId,
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
  ): Promise<TrackingResult<TimeEntry>> {
    return this.deviceRequest(
      'POST',
      '/device/time-entries/stop',
      deviceToken,
      endedAt ? { endedAt } : {},
    );
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
    samples: ActivitySamplePayload[],
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
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${deviceToken}`,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
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
