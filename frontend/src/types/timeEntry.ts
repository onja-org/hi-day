import type { ApiResult } from "./api";
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
  /**
   * Non-null while the entry has an open pause span — the instant that
   * pause began. The elapsed-time display freezes at that instant rather
   * than continuing to tick.
   */
  pausedAt: string | null;
  /** Total seconds paused so far, across every *closed* pause span. */
  pausedSeconds: number;
};

export type PauseSpan = {
  pausedAt: string;
  /** null while this particular span is still open (currently paused). */
  resumedAt: string | null;
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
  /** Every pause span on this entry, oldest first. */
  pauses: PauseSpan[];
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

export type TimeEntryActionResult = ApiResult<
  { entry: TimeEntry },
  { runningEntry?: TimeEntry }
>;

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

export type CreateManualTimeEntryResult = ApiResult<{ entry: TimeEntry }>;

export type UpdateTimeEntryResult = ApiResult<{ entry: TimeEntry }>;
