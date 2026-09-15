// Every class name below must appear literally (not built via string
// concatenation) so Tailwind's content scanner can find it and generate the
// CSS — a dynamically-built class name like `${axis}-${fraction}` would
// silently produce no styles at all.
const WIDTH_STEPS: [number, string][] = [
  [0, "w-0"],
  [1 / 12, "w-1/12"],
  [1 / 6, "w-1/6"],
  [1 / 4, "w-1/4"],
  [1 / 3, "w-1/3"],
  [5 / 12, "w-5/12"],
  [1 / 2, "w-1/2"],
  [7 / 12, "w-7/12"],
  [2 / 3, "w-2/3"],
  [3 / 4, "w-3/4"],
  [5 / 6, "w-5/6"],
  [11 / 12, "w-11/12"],
  [1, "w-full"],
];

const HEIGHT_STEPS: [number, string][] = [
  [0, "h-0"],
  [1 / 12, "h-1/12"],
  [1 / 6, "h-1/6"],
  [1 / 4, "h-1/4"],
  [1 / 3, "h-1/3"],
  [5 / 12, "h-5/12"],
  [1 / 2, "h-1/2"],
  [7 / 12, "h-7/12"],
  [2 / 3, "h-2/3"],
  [3 / 4, "h-3/4"],
  [5 / 6, "h-5/6"],
  [11 / 12, "h-11/12"],
  [1, "h-full"],
];

function closestStep(steps: [number, string][], ratio: number): string {
  const clamped = Math.min(1, Math.max(0, ratio));
  let closest = steps[0];
  let smallestDiff = Infinity;
  for (const step of steps) {
    const diff = Math.abs(step[0] - clamped);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      closest = step;
    }
  }
  return closest[1];
}

/**
 * Rounds `ratio` (0-1) to the nearest step on Tailwind's fixed fractional
 * width/height scale and returns the matching class, e.g.
 * `fractionClass("w", 0.4)` → `"w-5/12"`. Bar/progress-style sizing can't
 * use inline `style` or an arbitrary bracketed value per the project's
 * Tailwind conventions, so a continuous ratio has to snap to a real
 * utility class instead.
 */
export function fractionClass(axis: "w" | "h", ratio: number): string {
  return axis === "w"
    ? closestStep(WIDTH_STEPS, ratio)
    : closestStep(HEIGHT_STEPS, ratio);
}
