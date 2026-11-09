import { formatElapsed } from "./formatElapsed";
import type { TimeEntryListItem } from "@/types/timeEntry";

/** A healthy running timer is behind by the open period plus one awaiting
 * the queue's flush. A fixed lag, not a ratio. */
const EXPECTED_LAG_SECONDS = 600 + 60;

/**
 * How much of an entry its percentage describes, when that is materially
 * less than the entry — otherwise null. The average covers measured time
 * only, so "90%" across the last 10 of 50 minutes reads as a claim about
 * all 50. Errs toward labelling: a stale qualifier is recoverable where a
 * flat percentage over a tenth of the entry is not.
 */
export function activityCoverageLabel(entry: TimeEntryListItem): string | null {
  const covered = entry.activityCoveredSeconds;
  const measurable = entry.activityMeasurableSeconds;
  if (
    covered === null ||
    covered === undefined ||
    measurable === null ||
    measurable === undefined
  ) {
    return null;
  }
  if (measurable - covered <= EXPECTED_LAG_SECONDS) return null;

  return `Covers ${formatElapsed(covered * 1000)} of ${formatElapsed(measurable * 1000)} tracked`;
}
