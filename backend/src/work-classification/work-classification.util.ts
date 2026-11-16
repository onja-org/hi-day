import {
  findEntryCovering,
  TimeEntryCoverageWindow,
} from '../common/time-entry-coverage.util';
import type {
  WorkItemKind,
  WorkLabel,
} from '../database/entities/work-classification.entity';

/** Each app reading stands for this much foreground time — see AppEventsService. */
export const APP_SAMPLE_SECONDS = 5;

export interface WorkTimeSplit {
  coreSeconds: number;
  nonCoreSeconds: number;
  unclassifiedSeconds: number;
}

/** A label lookup keyed by `labelKey(kind, name)`. */
export type WorkLabels = Map<string, WorkLabel>;

export const labelKey = (kind: WorkItemKind, name: string): string =>
  `${kind}:${name}`;

interface AppReading {
  appName: string;
  sampledAt: Date;
}

interface SiteVisit {
  host: string;
  startedAt: Date;
  endedAt: Date;
}

/**
 * How a member's tracked app time splits into core, non-core and
 * unclassified. Each app reading counts once, as `APP_SAMPLE_SECONDS`:
 *
 * - Only readings a Time entry covers count, as everywhere else app time
 *   is shown — off the timer there's nothing to attribute them to.
 * - While a website visit covers the reading, the site's label decides —
 *   a browser is core or not depending on what's open in it. A visit only
 *   runs while its browser has focus, so the two always agree. With no
 *   site recorded (apps-only tracking, or a page whose address couldn't be
 *   read) the browser's own label applies.
 * - No label is "unclassified", never non-core.
 *
 * `readings` and `visits` must each be sorted by time.
 */
export function splitWorkTime(
  readings: AppReading[],
  visits: SiteVisit[],
  entries: TimeEntryCoverageWindow[],
  labels: WorkLabels,
): WorkTimeSplit {
  const split: WorkTimeSplit = {
    coreSeconds: 0,
    nonCoreSeconds: 0,
    unclassifiedSeconds: 0,
  };
  let visitIndex = 0;

  for (const reading of readings) {
    if (!findEntryCovering(entries, reading.sampledAt)) continue;

    const at = reading.sampledAt.getTime();
    while (
      visitIndex < visits.length &&
      visits[visitIndex].endedAt.getTime() <= at
    ) {
      visitIndex += 1;
    }
    const visit = visits[visitIndex];
    const onSite = visit !== undefined && visit.startedAt.getTime() <= at;

    const label = onSite
      ? labels.get(labelKey('site', visit.host))
      : labels.get(labelKey('app', reading.appName));

    if (label === 'core') split.coreSeconds += APP_SAMPLE_SECONDS;
    else if (label === 'non_core') split.nonCoreSeconds += APP_SAMPLE_SECONDS;
    else split.unclassifiedSeconds += APP_SAMPLE_SECONDS;
  }

  return split;
}
