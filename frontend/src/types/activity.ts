import type { ApiResult } from "./api";

export type ActivityEntry = {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
};

export type CreateActivityInput = {
  content: string;
};

export type CreateActivityResult = ApiResult<{ entry: ActivityEntry }>;

export type GetActivityResult =
  | { ok: true; entries: ActivityEntry[] }
  | { ok: false; message: string };
