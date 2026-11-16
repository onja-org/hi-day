/** A count short enough for a quarter of a row: 412, 1.2k, 18.4k, 3.1M. */
export function formatCompactCount(value: number): string {
  if (value < 1000) return String(Math.round(value));
  if (value < 1_000_000) return `${trimmed(value / 1000)}k`;
  return `${trimmed(value / 1_000_000)}M`;
}

/** One decimal under 100, none above, and no trailing ".0". */
function trimmed(value: number): string {
  const rounded = value < 100 ? Math.round(value * 10) / 10 : Math.round(value);
  return String(rounded);
}
