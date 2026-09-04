import type { ProjectColour } from "./project";

export type TimeEntrySource = "web" | "agent" | "manual";

export type TimeEntry = {
  id: string;
  membershipId: string;
  projectId: string;
  taskId: string | null;
  startedAt: string;
  endedAt: string | null;
  source: TimeEntrySource;
  deviceId: string | null;
};

export type TimeEntryListItem = TimeEntry & {
  projectName: string;
  projectColour: ProjectColour;
  taskName: string | null;
  /** null while the entry is still running. */
  durationSeconds: number | null;
  /**
   * Whether the *viewer* can edit this entry — admin can edit anyone's,
   * manager can edit anyone's but their own, a plain member/finance can't
   * edit anyone's, not even their own.
   */
  canEdit: boolean;
};

export type GetTimeEntriesResult =
  | { ok: true; entries: TimeEntryListItem[] }
  | { ok: false; message: string };

export type CurrentTimeEntry = {
  entry: TimeEntry | null;
  now: string;
};

export type GetCurrentTimeEntryResult =
  | { ok: true; data: CurrentTimeEntry }
  | { ok: false; message: string };

export type TimeEntryActionResult =
  | { ok: true; entry: TimeEntry }
  | { ok: false; message: string; runningEntry?: TimeEntry };

export type TimeEntryFormInput = {
  projectId: string;
  taskId?: string;
  /** Local `datetime-local` input values, converted to ISO before sending. */
  startedAt: string;
  endedAt: string;
};

export type UpdateTimeEntryInput = {
  projectId?: string;
  taskId?: string | null;
  startedAt?: string;
  endedAt?: string;
};

export type CreateManualTimeEntryResult =
  | { ok: true; entry: TimeEntry }
  | { ok: false; message: string };

export type UpdateTimeEntryResult =
  | { ok: true; entry: TimeEntry }
  | { ok: false; message: string };
