export type ResetPasswordInput = {
  token: string;
  password: string;
};

import type { ApiResult } from "./api";

export type ResetPasswordResult = ApiResult;
