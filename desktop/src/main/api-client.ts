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
}
