/** An inclusive instant range — `from` is a local start-of-day, `to` a
 * local end-of-day (23:59:59.999), matching the `from`/`to` the
 * time-entries API filters on. */
export type DateRange = {
  from: Date;
  to: Date;
};

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_week"
  | "last_2_weeks"
  | "this_month"
  | "last_month";

/** The date-range picker's in-progress (not yet applied) selection.
 * `pickingEnd` is true after the first click of a range — the next click
 * sets its other end. */
export type RangeSelection = DateRange & {
  pickingEnd: boolean;
};
