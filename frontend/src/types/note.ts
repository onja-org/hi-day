import type { ApiResult } from "./api";

export type Note = {
  id: string;
  membershipId: string;
  projectId: string | null;
  noteDate: string;
  content: string;
  createdAt: string;
};

export type CreateNoteInput = {
  noteDate: string;
  projectId?: string;
  content: string;
};

export type CreateNoteResult = ApiResult<{ note: Note }>;

export type ListNotesResult =
  | { ok: true; notes: Note[] }
  | { ok: false; message: string };

export type DeleteNoteResult = ApiResult;
