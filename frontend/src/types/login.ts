import type { ApiResult } from "./api";

export type LoginInput = {
  email: string;
  password: string;
  captchaToken?: string;
};

export type LoginResult = ApiResult<object, { captchaRequired?: boolean }>;
