import { Interval, mergeIntervals } from '../common/time-entry-union.util';
import type { SamplePeriod } from '../screenshots/screenshot-slots.util';
import type { DayBounds, TimelineDay } from './timeline.util';

/** A focus session is at least this long… */
const FOCUS_MIN_SECONDS = 20 * 60;
/** …of tracked time measured at or above this activity throughout. */
const FOCUS_MIN_ACTIVITY = 50;

export interface MemberPerformance {
  /** `null` when no expected work day has passed yet, or nothing was worked. */
  utilization: {
    averageDailySeconds: number;
    targetDailySeconds: number;
    expectedDays: number;
  } | null;
  /** `null` when nothing tracked was measured. */
  activity: { percentage: number } | null;
  /** `null` when nothing tracked was measured — focus is read off activity. */
  focus: {
    totalSeconds: number;
    sessions: number;
    averageSessionSeconds: number;
  } | null;
  /** Medians across worked days, in minutes from midnight on the org's calendar. */
  startStop: { startMinute: number; stopMinute: number; days: number } | null;
  /** `null` when there was no tracked or idle time at all. */
  idle: { idleSeconds: number; idleShare: number } | null;
}

/** The one figure per card that the comparison bars line up. */
export interface PerformanceAverages {
  averageDailySeconds: number | null;
  activityPercentage: number | null;
  focusSeconds: number | null;
  startMinute: number | null;
  stopMinute: number | null;
  idleShare: number | null;
  /** How many members' figures went into this average. */
  members: number;
}

export interface PerformanceInput {
  days: DayBounds[];
  /** `buildTimelineDays` over `days`, built with the same `samples`. */
  timeline: TimelineDay[];
  /** Empty when activity isn't recorded for this member. */
  samples: SamplePeriod[];
  /** 0 = Sunday, like `Date.getUTCDay()` on a day key. */
  expectedWorkDays: number[];
  hoursPerDay: number;
  /** Today on the organisation's calendar; later days haven't happened yet. */
  todayKey: string;
}

export function computeMemberPerformance(
  input: PerformanceInput,
): MemberPerformance {
  const { days, timeline } = input;
  const tracked = mergeIntervals(
    timeline.flatMap((day) =>
      day.segments
        .filter((segment) => segment.kind === 'tracked')
        .map((segment) => ({
          start: Date.parse(segment.start),
          end: Date.parse(segment.end),
        })),
    ),
  );

  return {
    utilization: utilization(input),
    activity: activity(tracked, input.samples),
    focus: focus(tracked, input.samples),
    startStop: startStop(days, timeline),
    idle: idle(timeline),
  };
}

/**
 * Worked time (tracked + manual) on every day so far, spread over the
 * expected work days so far — a weekend's work counts toward the average,
 * but a weekend doesn't count as a day that should have been worked.
 */
function utilization(
  input: PerformanceInput,
): MemberPerformance['utilization'] {
  const past = input.timeline.filter((day) => day.date <= input.todayKey);
  const expectedDays = past.filter((day) =>
    input.expectedWorkDays.includes(weekdayOf(day.date)),
  ).length;
  if (expectedDays === 0) return null;

  const worked = past.reduce(
    (sum, day) => sum + day.trackedSeconds + day.manualSeconds,
    0,
  );
  // No time at all is no evidence either way — likely leave or a member
  // not using the tracker — so it reads "Not enough data", not 0 h.
  if (worked === 0) return null;
  return {
    averageDailySeconds: Math.round(worked / expectedDays),
    targetDailySeconds: Math.round(input.hoursPerDay * 3600),
    expectedDays,
  };
}

function activity(
  tracked: Interval[],
  samples: SamplePeriod[],
): MemberPerformance['activity'] {
  let weighted = 0;
  let measuredMs = 0;
  for (const sample of samples) {
    for (const interval of tracked) {
      const overlap = overlapMs(interval, sample);
      if (overlap <= 0) continue;
      weighted += sample.activePercentage * overlap;
      measuredMs += overlap;
    }
  }
  return measuredMs > 0
    ? { percentage: Math.round(weighted / measuredMs) }
    : null;
}

/**
 * Tracked time where activity stayed at or above `FOCUS_MIN_ACTIVITY`,
 * kept as a session when it runs unbroken for `FOCUS_MIN_SECONDS`. An
 * unmeasured gap or a low sample ends a session, as does a pause or the
 * end of an entry.
 */
function focus(
  tracked: Interval[],
  samples: SamplePeriod[],
): MemberPerformance['focus'] {
  const measured = samples.some((sample) =>
    tracked.some((interval) => overlapMs(interval, sample) > 0),
  );
  if (!measured) return null;

  const focused = mergeIntervals(
    samples
      .filter((sample) => sample.activePercentage >= FOCUS_MIN_ACTIVITY)
      .map((sample) => ({
        start: sample.periodStart.getTime(),
        end: sample.periodEnd.getTime(),
      })),
  );
  const sessions = mergeIntervals(
    tracked.flatMap((interval) =>
      focused
        .map((span) => ({
          start: Math.max(interval.start, span.start),
          end: Math.min(interval.end, span.end),
        }))
        .filter((span) => span.end > span.start),
    ),
  )
    .map((span) => Math.round((span.end - span.start) / 1000))
    .filter((seconds) => seconds >= FOCUS_MIN_SECONDS);

  const totalSeconds = sessions.reduce((sum, seconds) => sum + seconds, 0);
  return {
    totalSeconds,
    sessions: sessions.length,
    averageSessionSeconds:
      sessions.length > 0 ? Math.round(totalSeconds / sessions.length) : 0,
  };
}

/** The usual first start and last stop, over days with any worked time. */
function startStop(
  days: DayBounds[],
  timeline: TimelineDay[],
): MemberPerformance['startStop'] {
  const starts: number[] = [];
  const stops: number[] = [];
  timeline.forEach((day, index) => {
    const worked = day.segments.filter((segment) => segment.kind !== 'idle');
    if (worked.length === 0) return;
    const dayStart = days[index].start.getTime();
    starts.push(
      Math.min(...worked.map((segment) => Date.parse(segment.start))) -
        dayStart,
    );
    stops.push(
      Math.max(...worked.map((segment) => Date.parse(segment.end))) - dayStart,
    );
  });
  if (starts.length === 0) return null;

  const toMinute = (ms: number) => Math.round(ms / 60000);
  return {
    startMinute: toMinute(median(starts)),
    stopMinute: toMinute(median(stops)),
    days: starts.length,
  };
}

/** Idle time as a share of tracked time plus idle — manual time is never idle. */
function idle(timeline: TimelineDay[]): MemberPerformance['idle'] {
  const idleSeconds = timeline.reduce((sum, day) => sum + day.idleSeconds, 0);
  const trackedSeconds = timeline.reduce(
    (sum, day) => sum + day.trackedSeconds,
    0,
  );
  const total = idleSeconds + trackedSeconds;
  if (total === 0) return null;
  return {
    idleSeconds,
    idleShare: Math.round((idleSeconds / total) * 1000) / 1000,
  };
}

/**
 * Each card's figure averaged over the members who have one — a member
 * with no tracked time is left out of the activity average rather than
 * pulling it toward zero.
 */
export function averagePerformance(
  performances: MemberPerformance[],
): PerformanceAverages {
  const mean = (values: (number | undefined)[]): number | null => {
    const present = values.filter(
      (value): value is number => value !== undefined,
    );
    if (present.length === 0) return null;
    return present.reduce((sum, value) => sum + value, 0) / present.length;
  };
  const rounded = (value: number | null) =>
    value === null ? null : Math.round(value);

  const idleShare = mean(performances.map((p) => p.idle?.idleShare));
  return {
    averageDailySeconds: rounded(
      mean(performances.map((p) => p.utilization?.averageDailySeconds)),
    ),
    activityPercentage: rounded(
      mean(performances.map((p) => p.activity?.percentage)),
    ),
    focusSeconds: rounded(mean(performances.map((p) => p.focus?.totalSeconds))),
    startMinute: rounded(
      mean(performances.map((p) => p.startStop?.startMinute)),
    ),
    stopMinute: rounded(mean(performances.map((p) => p.startStop?.stopMinute))),
    idleShare: idleShare === null ? null : Math.round(idleShare * 1000) / 1000,
    members: performances.length,
  };
}

function weekdayOf(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay();
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function overlapMs(interval: Interval, sample: SamplePeriod): number {
  return (
    Math.min(interval.end, sample.periodEnd.getTime()) -
    Math.max(interval.start, sample.periodStart.getTime())
  );
}
