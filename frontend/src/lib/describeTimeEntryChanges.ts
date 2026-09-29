/** One field the user is about to change, ready to render in the save
 * confirmation. `from`/`to` are already display-formatted. */
export type TimeEntryChange = {
  label: string;
  from: string;
  to: string;
};

/** The comparable shape of a time entry, before and after an edit.
 * `startedAt`/`endedAt` are anything `Date` can parse — the entry's ISO
 * instants on one side, the form's `datetime-local` values on the other —
 * so they're compared as instants rather than as strings. */
export type TimeEntrySnapshot = {
  projectName: string;
  taskName: string | null;
  startedAt: string;
  endedAt: string;
};

const NO_TASK = "No task";
/** A paused entry has no end until one is set, so the "from" side of that
 * change would otherwise render as an empty gap. */
const NOT_SET = "not set";

function formatInstant(value: string): string {
  if (value === "") {
    return NOT_SET;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function sameInstant(before: string, after: string): boolean {
  const a = new Date(before).getTime();
  const b = new Date(after).getTime();
  // Two unparseable values are only "the same" if they're literally equal —
  // NaN === NaN is false, so compare the raw strings in that case.
  if (Number.isNaN(a) || Number.isNaN(b)) {
    return before === after;
  }
  return a === b;
}

/**
 * The fields that actually differ between an entry and the edit about to be
 * saved, in the order they appear in the form. Returns an empty array when
 * nothing changed — the caller can then skip the confirmation entirely
 * rather than asking someone to confirm a no-op (the backend treats a
 * no-op edit the same way, writing no audit row for it).
 */
export function describeTimeEntryChanges(
  before: TimeEntrySnapshot,
  after: TimeEntrySnapshot,
): TimeEntryChange[] {
  const changes: TimeEntryChange[] = [];

  if (before.projectName !== after.projectName) {
    changes.push({
      label: "Project",
      from: before.projectName,
      to: after.projectName,
    });
  }

  if ((before.taskName ?? null) !== (after.taskName ?? null)) {
    changes.push({
      label: "Task",
      from: before.taskName ?? NO_TASK,
      to: after.taskName ?? NO_TASK,
    });
  }

  if (!sameInstant(before.startedAt, after.startedAt)) {
    changes.push({
      label: "Start",
      from: formatInstant(before.startedAt),
      to: formatInstant(after.startedAt),
    });
  }

  if (!sameInstant(before.endedAt, after.endedAt)) {
    changes.push({
      label: "End",
      from: formatInstant(before.endedAt),
      to: formatInstant(after.endedAt),
    });
  }

  return changes;
}
