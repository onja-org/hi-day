const DAY_MS = 24 * 60 * 60 * 1000;

function keyToUtcMs(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

/**
 * Whole calendar days from one `YYYY-MM-DD` key to another — negative when
 * `to` is earlier. Counted on the keys themselves, so neither the runtime's
 * zone nor a daylight-saving change can shift it.
 */
export function daysBetweenKeys(from: string, to: string): number {
  return Math.round((keyToUtcMs(to) - keyToUtcMs(from)) / DAY_MS);
}
