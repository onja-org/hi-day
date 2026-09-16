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

export type CreateNoteResult =
  | { ok: true; note: Note }
  | { ok: false; message: string };

export type ListNotesResult =
  | { ok: true; notes: Note[] }
  | { ok: false; message: string };

export type DeleteNoteResult = { ok: true } | { ok: false; message: string };
