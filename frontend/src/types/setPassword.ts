export type SetPasswordInput = {
  token: string;
  password: string;
};

import type { ApiResult } from "./api";

export type SetPasswordResult = ApiResult;
