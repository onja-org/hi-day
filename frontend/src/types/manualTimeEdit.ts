export type ManualTimeEditAction = "add" | "edit" | "delete";

/** One manual add, edit or delete of a time entry, as the Manual time edits report lists it. */
export type ManualTimeEdit = {
  id: string;
  action: ManualTimeEditAction;
  membershipId: string | null;
  memberName: string | null;
  memberEmail: string | null;
  projectId: string | null;
  projectName: string | null;
  taskName: string | null;
  startedAt: string | null;
  endedAt: string | null;
  /** Signed: what the edit added to (or took from) the member's tracked time. */
  changeSeconds: number;
  reason: string | null;
  changedByName: string | null;
  changedAt: string;
};

export type GetManualTimeEditsResult =
  | { ok: true; edits: ManualTimeEdit[] }
  | { ok: false; message: string };
