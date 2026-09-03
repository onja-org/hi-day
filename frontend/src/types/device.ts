export type DevicePlatform = "windows" | "macos" | "linux" | "ios" | "android";

export type DeviceStatus = "active" | "offline" | "signed_out";

export type Device = {
  id: string;
  status: DeviceStatus;
  platform: DevicePlatform;
  osVersion: string | null;
  hostname: string | null;
  appVersion: string | null;
  userId: string;
  userEmail: string;
  userName: string | null;
  lastSeenAt: string | null;
  createdAt: string;
};

export type GetDevicesResult =
  | { ok: true; devices: Device[] }
  | { ok: false; message: string };

export type SignOutDeviceResult =
  | { ok: true; device: Device }
  | { ok: false; message: string };
