import type { WorkTimeShares } from "@/types/workClassification";

/**
 * Core, non-core and unclassified as whole percentages that always add up
 * to 100 — rounding each on its own can give 99 or 101, which reads as a
 * mistake. The remainder goes to whichever share lost most to rounding.
 */
export function workTimeShares(split: {
  coreSeconds: number;
  nonCoreSeconds: number;
  unclassifiedSeconds: number;
}): WorkTimeShares {
  const total = split.coreSeconds + split.nonCoreSeconds + split.unclassifiedSeconds;
  if (total === 0) return { core: 0, nonCore: 0, unclassified: 0 };

  const exact = [split.coreSeconds, split.nonCoreSeconds, split.unclassifiedSeconds].map(
    (seconds) => (seconds / total) * 100,
  );
  const rounded = exact.map(Math.floor);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);
  let missing = 100 - rounded.reduce((sum, value) => sum + value, 0);
  for (const { index } of byRemainder) {
    if (missing === 0) break;
    rounded[index] += 1;
    missing -= 1;
  }

  const [core, nonCore, unclassified] = rounded;
  return { core, nonCore, unclassified };
}
