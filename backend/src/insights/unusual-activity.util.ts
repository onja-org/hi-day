import { Interval, mergeIntervals } from '../common/time-entry-union.util';
import type { SamplePeriod } from '../screenshots/screenshot-slots.util';
import type { DayBounds, TimelineDay } from './timeline.util';

export type UnusualRule =
  | 'consistent_activity'
  | 'high_activity'
  | 'breakless_work'
  | 'sustained_high_activity';

export type UnusualSeverity = 'highly_unusual' | 'unusual' | 'slightly_unusual';

/** One rule firing on one stretch — the raw material instances are built from. */
export interface UnusualFinding {
  /** `YYYY-MM-DD` on the organisation's calendar. */
  date: string;
  rule: UnusualRule;
  start: number;
  end: number;
  reason: string;
}

/**
 * A stretch that stood out: one or more findings that overlap, reported
 * once, at the severity of the strongest, with every reason.
 */
export interface UnusualInstance {
  /** `YYYY-MM-DD` on the organisation's calendar. */
  date: string;
  start: string;
  end: string;
  durationSeconds: number;
  severity: UnusualSeverity;
  rules: UnusualRule[];
  /** Strongest first; the first is the one-line summary. */
  reasons: string[];
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** Samples further apart than this aren't one unbroken stretch. */
const CONTIGUOUS_GAP_MS = MINUTE;

/** The shortest stretch each rule flags, which severity is measured against. */
const RULE_MIN_MS: Record<UnusualRule, number> = {
  // Exactly the same activity for 40 min, or within 4 points for 90 min.
  consistent_activity: 40 * MINUTE,
  high_activity: 30 * MINUTE,
  breakless_work: 5 * HOUR,
  sustained_high_activity: 5 * HOUR,
};
const CONSISTENT_RANGE_MIN_MS = 90 * MINUTE;
const CONSISTENT_RANGE_POINTS = 4;
const HIGH_ACTIVITY_MIN = 95;
const BREAKLESS_ACTIVITY_MIN = 30;
const SUSTAINED_ACTIVITY_ABOVE = 80;

/**
 * Breakless work and sustained high activity happen in real, focused days
 * too, so on their own they're not worth a manager's attention. They're
 * only reported on a day a main rule also fired.
 */
const SUPPORTING_RULES: UnusualRule[] = [
  'breakless_work',
  'sustained_high_activity',
];

/**
 * A rule that fired on at least this many of the member's previous
 * `BASELINE_DAYS` days is their normal way of working, and isn't flagged.
 */
const NORMAL_PATTERN_MIN_DAYS = 5;
export const BASELINE_DAYS = 30;

const SEVERITY_ORDER: UnusualSeverity[] = [
  'highly_unusual',
  'unusual',
  'slightly_unusual',
];

interface Sample {
  start: number;
  end: number;
  value: number;
}

/**
 * Every rule that fires on these days, before anything is compared with
 * the member's own habits. Only activity measured during tracked time
 * counts, the same rule the Timeline and Activity views apply.
 */
export function findUnusualActivity(
  days: DayBounds[],
  timeline: TimelineDay[],
  samples: SamplePeriod[],
): UnusualFinding[] {
  return days.flatMap((day, index) => {
    const tracked = mergeIntervals(
      timeline[index].segments
        .filter((segment) => segment.kind === 'tracked')
        .map((segment) => ({
          start: Date.parse(segment.start),
          end: Date.parse(segment.end),
        })),
    );
    const daySamples = samplesWithin(samples, tracked, day);

    return [
      ...consistentActivity(daySamples),
      ...runsWhere(daySamples, (value) => value >= HIGH_ACTIVITY_MIN)
        .filter((run) => spanMs(run) >= RULE_MIN_MS.high_activity)
        .map((run) => found('high_activity', run, highReason(run))),
      ...runsWhere(daySamples, (value) => value >= BREAKLESS_ACTIVITY_MIN)
        .filter((run) => spanMs(run) >= RULE_MIN_MS.breakless_work)
        .map((run) =>
          found(
            'breakless_work',
            run,
            `Tracked ${formatSpan(spanMs(run))} without a break, activity never below ${BREAKLESS_ACTIVITY_MIN}%`,
          ),
        ),
      ...sustainedHighActivity(daySamples),
    ].map((finding) => ({ ...finding, date: day.date }));
  });
}

/**
 * The rules that are this member's normal way of working: any that fired
 * on `NORMAL_PATTERN_MIN_DAYS` or more of the baseline days.
 */
export function normalRulesFor(baseline: UnusualFinding[]): UnusualRule[] {
  const daysByRule = new Map<UnusualRule, Set<string>>();
  for (const finding of baseline) {
    const days = daysByRule.get(finding.rule) ?? new Set<string>();
    days.add(finding.date);
    daysByRule.set(finding.rule, days);
  }
  return [...daysByRule.entries()]
    .filter(([, days]) => days.size >= NORMAL_PATTERN_MIN_DAYS)
    .map(([rule]) => rule)
    .sort();
}

/**
 * Findings turned into what a manager sees: rules that are normal for the
 * member dropped first — so they can't raise anything else's severity
 * either — supporting rules kept only on a day a main rule still fired,
 * and overlapping findings reported as one instance.
 */
export function buildUnusualInstances(
  findings: UnusualFinding[],
  normal: UnusualRule[],
): UnusualInstance[] {
  const kept = findings.filter((finding) => !normal.includes(finding.rule));
  const byDay = new Map<string, UnusualFinding[]>();
  for (const finding of kept) {
    byDay.set(finding.date, [...(byDay.get(finding.date) ?? []), finding]);
  }

  return [...byDay.values()].flatMap((day) => {
    if (day.every((finding) => SUPPORTING_RULES.includes(finding.rule))) {
      return [];
    }
    const rated = day.map((finding) => ({
      ...finding,
      severity: severityOf(finding, day),
    }));
    return groupOverlapping(rated).map(toInstance);
  });
}

/** Seconds affected per severity, counting overlapping instances once. */
export function affectedSecondsBySeverity(
  instances: UnusualInstance[],
): Record<UnusualSeverity, number> {
  const of = (severity: UnusualSeverity) => {
    const merged = mergeIntervals(
      instances
        .filter((instance) => instance.severity === severity)
        .map((instance) => ({
          start: Date.parse(instance.start),
          end: Date.parse(instance.end),
        })),
    );
    return Math.round(
      merged.reduce((sum, span) => sum + span.end - span.start, 0) / 1000,
    );
  };
  return {
    highly_unusual: of('highly_unusual'),
    unusual: of('unusual'),
    slightly_unusual: of('slightly_unusual'),
  };
}

type Found = Omit<UnusualFinding, 'date'>;
type Rated = UnusualFinding & { severity: UnusualSeverity };

function found(rule: UnusualRule, run: Sample[], reason: string): Found {
  return { rule, start: run[0].start, end: run[run.length - 1].end, reason };
}

/**
 * How far past its rule's shortest stretch a finding ran: just past is
 * slightly unusual, twice as long unusual, three times highly unusual. A
 * main rule overlapping another main rule is highly unusual whatever its
 * length — two independent signals at once.
 */
function severityOf(
  finding: UnusualFinding,
  day: UnusualFinding[],
): UnusualSeverity {
  const ratio = (finding.end - finding.start) / RULE_MIN_MS[finding.rule];
  const corroborated =
    !SUPPORTING_RULES.includes(finding.rule) &&
    day.some(
      (other) =>
        other.rule !== finding.rule &&
        !SUPPORTING_RULES.includes(other.rule) &&
        other.start < finding.end &&
        other.end > finding.start,
    );
  if (corroborated || ratio >= 3) return 'highly_unusual';
  if (ratio >= 2) return 'unusual';
  return 'slightly_unusual';
}

/**
 * Findings that overlap, as one group each. Sustained high activity spans
 * a whole working day, so it stays its own instance rather than swallowing
 * every other stretch that day.
 */
function groupOverlapping(rated: Rated[]): Rated[][] {
  const daySpanning = rated.filter(
    (finding) => finding.rule === 'sustained_high_activity',
  );
  const groups: Rated[][] = [];
  const sorted = rated
    .filter((finding) => finding.rule !== 'sustained_high_activity')
    .sort((a, b) => a.start - b.start);
  for (const finding of sorted) {
    const current = groups[groups.length - 1];
    const currentEnd = current
      ? Math.max(...current.map((member) => member.end))
      : -Infinity;
    if (current && finding.start < currentEnd) {
      current.push(finding);
    } else {
      groups.push([finding]);
    }
  }
  return [...groups, ...daySpanning.map((finding) => [finding])].sort(
    (a, b) => a[0].start - b[0].start,
  );
}

function toInstance(group: Rated[]): UnusualInstance {
  const strongestFirst = [...group].sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
      a.start - b.start,
  );
  const start = Math.min(...group.map((finding) => finding.start));
  const end = Math.max(...group.map((finding) => finding.end));
  return {
    date: group[0].date,
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    durationSeconds: Math.round((end - start) / 1000),
    severity: strongestFirst[0].severity,
    rules: [...new Set(strongestFirst.map((finding) => finding.rule))],
    reasons: [...new Set(strongestFirst.map((finding) => finding.reason))],
  };
}

/**
 * Activity that barely moves: the exact same value for 40 min, or within 4
 * points for 90 min. An idle 0% isn't flagged — that's someone reading or
 * away, which idle time already covers. Where both fire on the same
 * stretch, the exact one is kept, since its reason is the sharper one.
 */
function consistentActivity(samples: Sample[]): Found[] {
  const exact = contiguousRuns(samples).flatMap((run) =>
    splitWhen(run, (previous, next) => previous.value !== next.value)
      .filter(
        (part) =>
          part[0].value > 0 && spanMs(part) >= RULE_MIN_MS.consistent_activity,
      )
      .map((part) =>
        found(
          'consistent_activity',
          part,
          `Activity stayed at exactly ${part[0].value}% for ${formatSpan(spanMs(part))}`,
        ),
      ),
  );

  const ranged: Found[] = [];
  for (const run of contiguousRuns(samples)) {
    let from = 0;
    while (from < run.length) {
      let to = from + 1;
      let low = run[from].value;
      let high = run[from].value;
      while (
        to < run.length &&
        Math.max(high, run[to].value) - Math.min(low, run[to].value) <=
          CONSISTENT_RANGE_POINTS
      ) {
        low = Math.min(low, run[to].value);
        high = Math.max(high, run[to].value);
        to += 1;
      }
      const part = run.slice(from, to);
      if (high > 0 && spanMs(part) >= CONSISTENT_RANGE_MIN_MS) {
        const overlapsExact = exact.some(
          (instance) =>
            instance.start < part[part.length - 1].end &&
            instance.end > part[0].start,
        );
        if (!overlapsExact) {
          ranged.push(
            found(
              'consistent_activity',
              part,
              `Activity stayed between ${low}% and ${high}% for ${formatSpan(spanMs(part))}`,
            ),
          );
        }
        from = to;
      } else {
        from += 1;
      }
    }
  }
  return [...exact, ...ranged];
}

/** More than five hours above 80% in one day, spanning first to last. */
function sustainedHighActivity(samples: Sample[]): Found[] {
  const high = samples.filter(
    (sample) => sample.value > SUSTAINED_ACTIVITY_ABOVE,
  );
  const totalMs = high.reduce((sum, sample) => sum + spanMs([sample]), 0);
  if (totalMs <= RULE_MIN_MS.sustained_high_activity) return [];
  return [
    {
      rule: 'sustained_high_activity',
      start: high[0].start,
      end: high[high.length - 1].end,
      reason: `Activity above ${SUSTAINED_ACTIVITY_ABOVE}% for ${formatSpan(totalMs)} in one day`,
    },
  ];
}

function highReason(run: Sample[]): string {
  const span = formatSpan(spanMs(run));
  // Worded like flat activity's own reason, so a flat 100% — which both
  // rules catch — reads once rather than twice.
  return run.every((sample) => sample.value === 100)
    ? `Activity stayed at exactly 100% for ${span}`
    : `Activity stayed at ${HIGH_ACTIVITY_MIN}% or more for ${span}`;
}

/** Unbroken stretches of samples meeting `keep`. */
function runsWhere(
  samples: Sample[],
  keep: (value: number) => boolean,
): Sample[][] {
  return contiguousRuns(samples).flatMap((run) =>
    splitWhen(
      run,
      (previous, next) => keep(previous.value) !== keep(next.value),
    ).filter((part) => keep(part[0].value)),
  );
}

function contiguousRuns(samples: Sample[]): Sample[][] {
  return splitWhen(
    samples,
    (previous, next) => next.start - previous.end > CONTIGUOUS_GAP_MS,
  );
}

function splitWhen<T>(
  items: T[],
  breaks: (previous: T, next: T) => boolean,
): T[][] {
  const groups: T[][] = [];
  for (const item of items) {
    const current = groups[groups.length - 1];
    if (current && !breaks(current[current.length - 1], item)) {
      current.push(item);
    } else {
      groups.push([item]);
    }
  }
  return groups;
}

/**
 * The day's samples that fall inside tracked time, clipped to it, in order.
 * A sample belongs to the day it starts on.
 */
function samplesWithin(
  samples: SamplePeriod[],
  tracked: Interval[],
  day: DayBounds,
): Sample[] {
  const dayStart = day.start.getTime();
  const dayEnd = day.end.getTime();
  return samples
    .filter((sample) => {
      const start = sample.periodStart.getTime();
      return start >= dayStart && start < dayEnd;
    })
    .flatMap((sample) =>
      tracked
        .map((interval) => ({
          start: Math.max(interval.start, sample.periodStart.getTime()),
          end: Math.min(interval.end, sample.periodEnd.getTime()),
          value: sample.activePercentage,
        }))
        .filter((clipped) => clipped.end > clipped.start),
    )
    .sort((a, b) => a.start - b.start);
}

function spanMs(run: Sample[]): number {
  return run[run.length - 1].end - run[0].start;
}

/** "45 min", "2 h", "1 h 10 min". */
export function formatSpan(ms: number): string {
  const totalMinutes = Math.round(ms / MINUTE);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}
