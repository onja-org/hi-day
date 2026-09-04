export type TimesheetDatePreset = "today" | "yesterday" | "this_week" | "this_month" | "all";

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  const end = startOfDay(date);
  end.setDate(end.getDate() + 1);
  end.setMilliseconds(end.getMilliseconds() - 1);
  return end;
}

/**
 * Resolves a preset into a `{from, to}` instant range in the *viewer's*
 * local timezone (not UTC) — "today" means the caller's own calendar day,
 * matching how a person entering/reviewing hours actually thinks about
 * dates. Returns null for "all" (no filter).
 */
export function getTimesheetDateRange(
  preset: TimesheetDatePreset,
  now: Date = new Date(),
): { from: Date; to: Date } | null {
  if (preset === "all") {
    return null;
  }

  if (preset === "today") {
    return { from: startOfDay(now), to: endOfDay(now) };
  }

  if (preset === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
  }

  if (preset === "this_week") {
    const from = startOfDay(now);
    from.setDate(from.getDate() - from.getDay());
    return { from, to: endOfDay(now) };
  }

  // this_month
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
}
