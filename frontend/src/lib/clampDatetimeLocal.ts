/**
 * Holds a `datetime-local` value at `max`, for picking a time that hasn't
 * happened yet.
 *
 * `max` alone is not enough: it greys out later days in the calendar, but
 * the time spinner still winds past the current hour and the browser only
 * objects once the form is submitted. Clamping as the value changes makes
 * the later time unsettable rather than merely rejected.
 *
 * Compared as strings, which is safe here and cheaper than parsing: the
 * format is fixed-width and most-significant-first (`YYYY-MM-DDTHH:mm`), so
 * lexicographic order is chronological order.
 */
export function clampDatetimeLocal(value: string, max: string): string {
  if (value === "" || max === "") return value;
  return value > max ? max : value;
}
