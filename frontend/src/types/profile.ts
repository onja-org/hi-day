import type { ApiResult } from "./api";

export type MyProfile = {
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  /** Reported by their last-used client — see `useReportTimezone`. */
  timezone: string | null;
};

export type GetMyProfileResult =
  | { ok: true; profile: MyProfile }
  | { ok: false; message: string };

export type UpdateMyProfileInput = {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  timezone?: string;
};

export type UpdateMyProfileResult = ApiResult<{ profile: MyProfile }>;
