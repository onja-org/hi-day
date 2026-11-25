export type ResetPasswordInput = {
  token: string;
  password: string;
};

import type { ApiResult } from "./api";

/** `twoFactorRequired`: the password changed, but nobody is signed in —
 * the reset link alone doesn't get past two-step login. */
export type ResetPasswordResult = ApiResult<{ twoFactorRequired?: boolean }>;
