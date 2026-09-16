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
 * Monday-start week boundaries, navigable by a week `offset` from the week
 * containing `anchor` — distinct from `getTimesheetDateRange`'s Sunday-start
 * "this_week" preset, which drives the Daily tab's simpler today/yesterday/
 * this-week/this-month picker. The Weekly matrix and Calendar grid need real
 * prev/next-week navigation instead of a preset, and a timesheet week is
 * conventionally read Monday-first.
 */
export function getWeekRange(anchor: Date, offset = 0): { start: Date; end: Date } {
  const start = startOfDay(anchor);
  // getDay(): 0 = Sunday..6 = Saturday. Shift so Monday is day 0 of the week.
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday + offset * 7);
  const end = endOfDay(start);
  end.setDate(end.getDate() + 6);
  return { start, end };
}
