import type { Interval } from './time-entry-union.util';

/**
 * How much input one stretch of tracked time saw. Counts only: never which
 * key, what was typed, or where the mouse was.
 */
export interface InputCounts {
  keystrokes: number;
  mouseClicks: number;
  /** Distance the pointer travelled, in screen pixels. */
  mouseMovement: number;
}

/** A 10-minute sample's period and its counts; `null` or absent when the
 * agent couldn't count (Wayland, a missing macOS permission, a blocked
 * hook) or predates counting. */
export interface CountedPeriod {
  periodStart: Date;
  periodEnd: Date;
  inputCounts?: InputCounts | null;
}

/** The three columns as stored, back into one value — all set or none. */
export function inputCountsOf(row: {
  keystrokes?: number | null;
  mouseClicks?: number | null;
  mouseMovement?: number | null;
}): InputCounts | null {
  if (
    row.keystrokes == null ||
    row.mouseClicks == null ||
    row.mouseMovement == null
  ) {
    return null;
  }
  return {
    keystrokes: row.keystrokes,
    mouseClicks: row.mouseClicks,
    mouseMovement: row.mouseMovement,
  };
}

/**
 * The counts falling inside `window`. Sample periods aren't clock-aligned,
 * so each sample contributes in proportion to how much of its period lies
 * inside the window — the same overlap weighting the activity % uses.
 *
 * `null`, never zeros, when no overlapping sample carried counts: "not
 * available" and "no input" must stay different answers.
 */
export function inputCountsIn(
  samples: CountedPeriod[],
  window: Interval,
): InputCounts | null {
  let counted = false;
  let keystrokes = 0;
  let mouseClicks = 0;
  let mouseMovement = 0;
  for (const sample of samples) {
    if (!sample.inputCounts) continue;
    const periodStart = sample.periodStart.getTime();
    const periodEnd = sample.periodEnd.getTime();
    const overlap =
      Math.min(periodEnd, window.end) - Math.max(periodStart, window.start);
    if (overlap <= 0 || periodEnd <= periodStart) continue;
    const share = overlap / (periodEnd - periodStart);
    keystrokes += sample.inputCounts.keystrokes * share;
    mouseClicks += sample.inputCounts.mouseClicks * share;
    mouseMovement += sample.inputCounts.mouseMovement * share;
    counted = true;
  }
  return counted
    ? {
        keystrokes: Math.round(keystrokes),
        mouseClicks: Math.round(mouseClicks),
        mouseMovement: Math.round(mouseMovement),
      }
    : null;
}

/** Several stretches' counts added up; null only when none was counted. */
export function sumInputCounts(
  parts: (InputCounts | null)[],
): InputCounts | null {
  const counted = parts.filter((part): part is InputCounts => part !== null);
  if (counted.length === 0) return null;
  return counted.reduce(
    (total, part) => ({
      keystrokes: total.keystrokes + part.keystrokes,
      mouseClicks: total.mouseClicks + part.mouseClicks,
      mouseMovement: total.mouseMovement + part.mouseMovement,
    }),
    { keystrokes: 0, mouseClicks: 0, mouseMovement: 0 },
  );
}
