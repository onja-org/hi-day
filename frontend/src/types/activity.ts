export type ActivityEntry = {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
};

export type CreateActivityInput = {
  content: string;
};

export type CreateActivityResult =
  | { ok: true; entry: ActivityEntry }
  | { ok: false; message: string };

export type GetActivityResult =
  | { ok: true; entries: ActivityEntry[] }
  | { ok: false; message: string };
