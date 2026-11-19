import type { ApiResult } from "./api";

export type LoginInput = {
  email: string;
  password: string;
  captchaToken?: string;
};

export type LoginResult = ApiResult<
  /** The password was right; the code step comes next. */
  { twoFactorRequired?: boolean },
  { captchaRequired?: boolean }
>;
