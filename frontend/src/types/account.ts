export type CreateAccountInput = {
  firstName: string;
  lastName: string;
  email: string;
  companyName: string;
  address: string;
  website?: string;
};

import type { ApiResult } from "./api";

export type CreateAccountResult = ApiResult;
