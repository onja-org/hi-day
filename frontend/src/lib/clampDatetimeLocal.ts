/**
 * Holds a `datetime-local` value at `max`, so a future time cannot be kept.
 *
 * Compared as strings: `YYYY-MM-DDTHH:mm` is fixed-width and
 * most-significant-first, so lexicographic order is chronological order.
 */
export function clampDatetimeLocal(value: string, max: string): string {
  if (value === "" || max === "") return value;
  return value > max ? max : value;
}
