import type { ApiResult } from "./api";
import type { ProjectColour } from "./project";

export type TimeEntrySource = "web" | "agent" | "manual";

/** What kind of time an entry holds, as opposed to where it was tracked.
 * `idle` is a stretch kept as its own entry instead of being deleted. */
export type TimeEntryType = "normal" | "idle" | "resumed" | "manual";

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
  memberName: string | null;
  memberEmail: string | null;
  type: TimeEntryType;
  /** Keyboard/mouse activity across the entry, 0-100, or null when nothing
   * measured it — which is not the same as 0%. */
  activePercentage: number | null;
  /** Whether the viewer can edit *and split* this entry — admin only. */
  canEdit: boolean;
  /** Whether the viewer can delete it — their own always, anyone's if an
   * admin. Deliberately wider than `canEdit`. */
  canDelete: boolean;
  /** Every pause span on this entry, oldest first. */
  pauses: PauseSpan[];
};

export type GetTimeEntriesResult =
  | { ok: true; entries: TimeEntryListItem[] }
  | { ok: false; message: string };

export type CurrentTimeEntry = {
  /** The web's own running timer — never a desktop's. */
  entry: TimeEntry | null;
  /** A timer running on one of the person's devices. Pins which Project the
   * web may start; never controlled from here. */
  elsewhere: TimeEntry | null;
  now: string;
  /** Present on the one poll that ends a timer for crossing a limit. */
  limitReached?: { kind: "daily" | "weekly"; limitHours: number };
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
  /** Omit to log for yourself — logging for someone else requires the
   * caller to be an org admin/manager, or a project-level manager. */
  membershipId?: string;
  /** Why the time was added by hand; kept in the audit log and the Manual
   * time edits report, same as an edit's or a deletion's. */
  reason?: string;
};

export type UpdateTimeEntryInput = {
  projectId?: string;
  taskId?: string | null;
  startedAt?: string;
  endedAt?: string;
  /** Why the entry was changed; kept in the audit log and the Manual time edits report. */
  reason?: string;
};

export type CreateManualTimeEntryResult = ApiResult<{ entry: TimeEntry }>;

export type UpdateTimeEntryResult = ApiResult<{ entry: TimeEntry }>;

/** Split returns both halves: the shortened original and the new second
 * entry it was cut from. */
export type SplitTimeEntryResult = ApiResult<{
  first: TimeEntry;
  second: TimeEntry;
}>;

/** Delete returns no entry — the row is gone, and the only surviving
 * record of it is the backend's `time_entry.deleted` audit row. */
export type DeleteTimeEntryResult = ApiResult;
