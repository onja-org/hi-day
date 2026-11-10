export type SetPasswordInput = {
  token: string;
  password: string;
  /** Becomes the new Organisation's time zone — see `detectTimezone`. */
  timezone?: string;
};

import type { ApiResult } from "./api";

export type SetPasswordResult = ApiResult;
