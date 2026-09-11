import type { DevicePlatform } from "./device";

export type DevicePairingSummary = {
  platform: DevicePlatform;
  hostname: string | null;
  requestedAt: string;
};

export type GetDevicePairingResult =
  | { ok: true; summary: DevicePairingSummary }
  | { ok: false; message: string };

export type ApproveDevicePairingResult =
  | { ok: true }
  | { ok: false; message: string };
