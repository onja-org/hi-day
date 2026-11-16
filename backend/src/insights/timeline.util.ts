import {
  activeIntervals,
  Interval,
  mergeIntervals,
  PauseLike,
  unionSeconds,
} from '../common/time-entry-union.util';
import { TimeEntry } from '../database/entities/time-entry.entity';
import { TimeEntryType } from '../database/entities/time-entry-type.enum';
import type { SamplePeriod } from '../screenshots/screenshot-slots.util';

export type TimelineSegmentKind = 'tracked' | 'manual' | 'idle';

export interface TimelineSegment {
  start: string;
  end: string;
  kind: TimelineSegmentKind;
  /** Only for `tracked`: manual and idle time have no input to measure. */
  activePercentage: number | null;
}

export interface TimelineDay {
  /** `YYYY-MM-DD` on the organisation's calendar. */
  date: string;
  segments: TimelineSegment[];
  trackedSeconds: number;
  manualSeconds: number;
  idleSeconds: number;
  /** Weighted over tracked time only; `null` when nothing was measured. */
  activePercentage: number | null;
}

export interface DayBounds {
  date: string;
  start: Date;
  end: Date;
}

type TimelineEntry = Pick<
  TimeEntry,
  'id' | 'startedAt' | 'endedAt' | 'type' | 'idleSeconds'
>;

interface KindedInterval extends Interval {
  kind: TimelineSegmentKind;
}

/**
 * One row per day for the Insights Timeline: the day's time cut into
 * tracked, manual and idle segments, with totals and activity.
 *
 * Pauses are netted out through the same `activeIntervals` the timesheet
 * uses, so a day's tracked + manual seconds here match its timesheet total
 * unless two Devices overlapped (each kind is unioned on its own, so time
 * shared *across* kinds can still count twice — rare, and visible in the
 * bar as an overlap).
 */
export function buildTimelineDays(
  days: DayBounds[],
  entries: TimelineEntry[],
  pausesByEntry: Map<string, PauseLike[]>,
  samples: SamplePeriod[],
  now: Date,
): TimelineDay[] {
  const kinded = entries.flatMap((entry) =>
    kindedIntervals(entry, pausesByEntry.get(entry.id) ?? [], now),
  );

  return days.map((day) => {
    const window = { start: day.start.getTime(), end: day.end.getTime() };
    const inDay = kinded
      .map((interval) => clip(interval, window))
      .filter((interval): interval is KindedInterval => interval !== null)
      .sort((a, b) => a.start - b.start);

    const ofKind = (kind: TimelineSegmentKind): Interval[] =>
      inDay.filter((interval) => interval.kind === kind);

    return {
      date: day.date,
      segments: inDay.map((interval) => ({
        start: new Date(interval.start).toISOString(),
        end: new Date(interval.end).toISOString(),
        kind: interval.kind,
        activePercentage:
          interval.kind === 'tracked'
            ? weightedActivity(samples, [interval])
            : null,
      })),
      trackedSeconds: unionSeconds(ofKind('tracked')),
      manualSeconds: unionSeconds(ofKind('manual')),
      idleSeconds: unionSeconds(ofKind('idle')),
      activePercentage: weightedActivity(
        samples,
        mergeIntervals(ofKind('tracked')),
      ),
    };
  });
}

/**
 * An entry's active stretches, labelled. A `resumed` entry opens with the
 * idle time the person chose to keep (`idleSeconds`), so that slice is
 * idle and the rest tracked.
 */
function kindedIntervals(
  entry: TimelineEntry,
  pauses: PauseLike[],
  now: Date,
): KindedInterval[] {
  const intervals = activeIntervals(entry, pauses, now);

  switch (entry.type) {
    case TimeEntryType.MANUAL:
      return intervals.map((interval) => ({ ...interval, kind: 'manual' }));
    case TimeEntryType.IDLE:
      return intervals.map((interval) => ({ ...interval, kind: 'idle' }));
    case TimeEntryType.RESUMED: {
      const idleEnd =
        entry.startedAt.getTime() + (entry.idleSeconds ?? 0) * 1000;
      return intervals.flatMap((interval): KindedInterval[] => {
        if (interval.end <= idleEnd) return [{ ...interval, kind: 'idle' }];
        if (interval.start >= idleEnd) {
          return [{ ...interval, kind: 'tracked' }];
        }
        return [
          { start: interval.start, end: idleEnd, kind: 'idle' },
          { start: idleEnd, end: interval.end, kind: 'tracked' },
        ];
      });
    }
    default:
      return intervals.map((interval) => ({ ...interval, kind: 'tracked' }));
  }
}

function clip(
  interval: KindedInterval,
  window: Interval,
): KindedInterval | null {
  const start = Math.max(interval.start, window.start);
  const end = Math.min(interval.end, window.end);
  return end > start ? { ...interval, start, end } : null;
}

/**
 * Average activity across `covered`, weighted by how long each sample
 * overlaps it. Samples outside tracked time are ignored — activity against
 * untracked time is noise the Activity views refuse too.
 */
function weightedActivity(
  samples: SamplePeriod[],
  covered: Interval[],
): number | null {
  let weighted = 0;
  let measuredMs = 0;
  for (const sample of samples) {
    for (const interval of covered) {
      const overlap =
        Math.min(interval.end, sample.periodEnd.getTime()) -
        Math.max(interval.start, sample.periodStart.getTime());
      if (overlap <= 0) continue;
      weighted += sample.activePercentage * overlap;
      measuredMs += overlap;
    }
  }
  return measuredMs > 0 ? Math.round(weighted / measuredMs) : null;
}
