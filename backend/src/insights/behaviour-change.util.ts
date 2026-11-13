/** The Performance figures Highlights watches for a change in behaviour. */
export type BehaviourMetric = 'core_work' | 'activity' | 'focus_time';

/** The range is compared with this many periods of the same length just before it. */
export const COMPARISON_PERIODS = 3;

/** A move of this share of the member's own average, or more, gets a note. */
export const SIGNIFICANT_CHANGE = 0.15;

/**
 * One period's figures; `null` when it can't be measured (nothing tracked,
 * activity not recorded, app tracking off).
 */
export interface PeriodFigures {
  /** Core time as a share of classified and unclassified app time, 0–1. */
  coreWorkShare: number | null;
  activityPercentage: number | null;
  focusSeconds: number | null;
}

export interface BehaviourChange {
  metric: BehaviourMetric;
  direction: 'higher' | 'lower';
  /** How far from the average, as a whole percentage of it. */
  changePercent: number;
  /** In the metric's own unit: a 0–1 share, a percentage, or seconds. */
  current: number;
  average: number;
}

const METRICS: { metric: BehaviourMetric; figure: keyof PeriodFigures }[] = [
  { metric: 'core_work', figure: 'coreWorkShare' },
  { metric: 'activity', figure: 'activityPercentage' },
  { metric: 'focus_time', figure: 'focusSeconds' },
];

/**
 * Each metric in `current` against the member's own average over the
 * earlier periods that measured it. A note only when the move reaches
 * `SIGNIFICANT_CHANGE`; nothing when the earlier periods measured nothing
 * (a new member) or averaged zero, since there's no "x% lower" to say.
 */
export function findBehaviourChanges(
  current: PeriodFigures,
  previous: PeriodFigures[],
): BehaviourChange[] {
  return METRICS.flatMap(({ metric, figure }): BehaviourChange[] => {
    const now = current[figure];
    const earlier = previous
      .map((period) => period[figure])
      .filter((value): value is number => value !== null);
    if (now === null || earlier.length === 0) return [];

    const average =
      earlier.reduce((sum, value) => sum + value, 0) / earlier.length;
    if (average === 0) return [];
    const change = (now - average) / average;
    if (Math.abs(change) < SIGNIFICANT_CHANGE) return [];

    return [
      {
        metric,
        direction: change > 0 ? 'higher' : 'lower',
        changePercent: Math.round(Math.abs(change) * 100),
        current: now,
        average,
      },
    ];
  });
}
