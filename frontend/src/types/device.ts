import type { ApiResult } from "./api";

export type DevicePlatform = "windows" | "macos" | "linux" | "ios" | "android";

export type DeviceStatus = "active" | "offline" | "signed_out";

/** Whether the desktop agent can record apps, or websites, as it last reported. */
export type CaptureStatus = "ok" | "degraded" | "unavailable";

export type Device = {
  id: string;
  status: DeviceStatus;
  platform: DevicePlatform;
  osVersion: string | null;
  hostname: string | null;
  appVersion: string | null;
  /** Null until an agent new enough to report it has checked in. */
  appCaptureStatus: CaptureStatus | null;
  appCaptureDetail: string | null;
  urlCaptureStatus: CaptureStatus | null;
  urlCaptureDetail: string | null;
  /** Linux only, e.g. "x11 · ubuntu:GNOME". */
  displaySession: string | null;
  userId: string;
  userEmail: string;
  userName: string | null;
  lastSeenAt: string | null;
  createdAt: string;
};

export type GetDevicesResult =
  | { ok: true; devices: Device[] }
  | { ok: false; message: string };

export type SignOutDeviceResult = ApiResult<{ device: Device }>;
