import type { DesktopDevicePlatform } from './platform';

export interface LoginRequest {
  email: string;
  password: string;
  deviceFingerprint: string;
  platform: DesktopDevicePlatform;
  osVersion: string;
  hostname: string;
  appVersion: string;
}

export type LoginResult =
  | { ok: true; deviceId: string; deviceToken: string }
  | { ok: false; message: string };

interface LoginResponseBody {
  message?: string;
  deviceId?: string;
  deviceToken?: string;
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

export type TrackingResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; runningEntry?: TimeEntry; unauthorized?: boolean };

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

  async login(request: LoginRequest): Promise<LoginResult> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
    } catch {
      return { ok: false, message: `Could not reach the server at ${this.baseUrl}.` };
    }

    const body = (await response.json().catch(() => ({}))) as LoginResponseBody;

    if (!response.ok || !body.deviceId || !body.deviceToken) {
      return { ok: false, message: body.message ?? 'Login failed.' };
    }

    return { ok: true, deviceId: body.deviceId, deviceToken: body.deviceToken };
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
   * Keeps this device's `lastSeenAt` fresh so the Devices page's
   * active/offline status (computed purely from how recently this was
   * last called — see backend's computeDeviceStatus) reflects reality
   * while the app is actually running, not just at login. Best-effort,
   * same reasoning as logout(): a missed heartbeat due to a transient
   * network blip just means this device shows offline until the next
   * one succeeds, not something worth surfacing to the user.
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

  getIdlePolicy(deviceToken: string): Promise<TrackingResult<IdlePolicy>> {
    return this.deviceRequest('GET', '/device/idle-policy', deviceToken);
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
    };
  }
}
