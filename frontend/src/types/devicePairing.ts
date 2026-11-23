import type { ApiResult } from "./api";
import type { DevicePlatform } from "./device";

export type DevicePairingOrganisation = {
  id: string;
  name: string;
};

export type DevicePairingSummary = {
  platform: DevicePlatform;
  hostname: string | null;
  requestedAt: string;
  /** Where the approver can link the device; more than one means they pick. */
  organisations: DevicePairingOrganisation[];
};

export type GetDevicePairingResult =
  | { ok: true; summary: DevicePairingSummary }
  | { ok: false; message: string };

export type ApproveDevicePairingResult = ApiResult;
