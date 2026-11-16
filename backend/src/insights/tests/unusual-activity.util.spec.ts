import { TimeEntryType } from '../../database/entities/time-entry-type.enum';
import { buildTimelineDays, DayBounds } from '../timeline.util';
import {
  affectedSecondsBySeverity,
  buildUnusualInstances,
  findUnusualActivity,
  formatSpan,
  normalRulesFor,
  UnusualFinding,
  UnusualInstance,
  UnusualRule,
} from '../unusual-activity.util';

const DAY_MS = 24 * 60 * 60 * 1000;
const TEN_MIN = 10 * 60 * 1000;
const MON = '2026-03-09';

const day = (date: string): DayBounds => {
  const start = new Date(`${date}T00:00:00Z`);
  return { date, start, end: new Date(start.getTime() + DAY_MS) };
};

/** A tracked entry from `from`, with one 10-minute sample per value. */
function tracked(from: string, values: number[]) {
  const start = Date.parse(from);
  const end = start + values.length * TEN_MIN;
  return {
    entry: {
      id: from,
      startedAt: new Date(start),
      endedAt: new Date(end),
      type: TimeEntryType.NORMAL,
      idleSeconds: null,
    },
    samples: values.map((activePercentage, index) => ({
      periodStart: new Date(start + index * TEN_MIN),
      periodEnd: new Date(start + (index + 1) * TEN_MIN),
      activePercentage,
    })),
  };
}

function find(...stretches: ReturnType<typeof tracked>[]): UnusualFinding[] {
  const days = [day(MON)];
  const entries = stretches.map((stretch) => stretch.entry);
  const samples = stretches.flatMap((stretch) => stretch.samples);
  return findUnusualActivity(
    days,
    buildTimelineDays(
      days,
      entries,
      new Map(),
      samples,
      new Date('2026-03-20T00:00:00Z'),
    ),
    samples,
  );
}

/** What a manager would see, with nothing normal for the member. */
function detect(...stretches: ReturnType<typeof tracked>[]): UnusualInstance[] {
  return buildUnusualInstances(find(...stretches), []);
}

const repeat = (value: number, times: number) =>
  Array.from({ length: times }, () => value);

describe('unusual activity', () => {
  it('finds nothing in ordinary, varied work', () => {
    expect(
      detect(tracked(`${MON}T09:00:00Z`, [62, 48, 85, 71, 55, 90, 40, 66])),
    ).toEqual([]);
  });

  describe('consistent activity', () => {
    it('flags the exact same value for 40 minutes', () => {
      expect(
        detect(tracked(`${MON}T09:00:00Z`, [50, ...repeat(73, 4), 40])),
      ).toEqual([
        {
          date: MON,
          start: `${MON}T09:10:00.000Z`,
          end: `${MON}T09:50:00.000Z`,
          durationSeconds: 40 * 60,
          severity: 'slightly_unusual',
          rules: ['consistent_activity'],
          reasons: ['Activity stayed at exactly 73% for 40 min'],
        },
      ]);
    });

    it('does not flag 30 minutes of the same value', () => {
      expect(detect(tracked(`${MON}T09:00:00Z`, repeat(73, 3)))).toEqual([]);
    });

    it('never flags a flat 0% — that is idle, not unusual', () => {
      expect(detect(tracked(`${MON}T09:00:00Z`, repeat(0, 12)))).toEqual([]);
    });

    it('flags activity within 4 points for 90 minutes', () => {
      const [instance] = detect(
        tracked(`${MON}T09:00:00Z`, [70, 72, 74, 71, 70, 73, 74, 72, 71]),
      );

      expect(instance).toMatchObject({
        durationSeconds: 90 * 60,
        reasons: ['Activity stayed between 70% and 74% for 1 h 30 min'],
      });
    });

    it('breaks a stretch at a gap in tracking', () => {
      expect(
        detect(
          tracked(`${MON}T09:00:00Z`, repeat(73, 2)),
          tracked(`${MON}T10:00:00Z`, repeat(73, 2)),
        ),
      ).toEqual([]);
    });
  });

  describe('high activity', () => {
    it('flags 95% or more for 30 minutes', () => {
      const [instance] = detect(tracked(`${MON}T09:00:00Z`, [96, 98, 95]));

      expect(instance).toMatchObject({
        rules: ['high_activity'],
        reasons: ['Activity stayed at 95% or more for 30 min'],
      });
    });
  });

  describe('one stretch, one instance', () => {
    it('reports a flat 100% once, with both reasons', () => {
      // Exactly the same value, and 95%+ — two rules, one stretch.
      const instances = detect(tracked(`${MON}T09:00:00Z`, repeat(100, 12)));

      expect(instances).toHaveLength(1);
      expect(instances[0]).toMatchObject({
        durationSeconds: 2 * 60 * 60,
        severity: 'highly_unusual',
        rules: ['consistent_activity', 'high_activity'],
        reasons: ['Activity stayed at exactly 100% for 2 h'],
      });
    });

    it('keeps separate stretches separate', () => {
      expect(
        detect(
          tracked(`${MON}T09:00:00Z`, repeat(73, 4)),
          tracked(`${MON}T14:00:00Z`, repeat(61, 4)),
        ),
      ).toHaveLength(2);
    });
  });

  describe('severity', () => {
    it('grows with how far past the shortest stretch it ran', () => {
      const of = (minutes: number) =>
        detect(
          tracked(`${MON}T09:00:00Z`, [50, ...repeat(73, minutes / 10)]),
        )[0].severity;

      expect(of(40)).toBe('slightly_unusual');
      expect(of(80)).toBe('unusual');
      expect(of(120)).toBe('highly_unusual');
    });
  });

  describe('breakless work and sustained high activity', () => {
    // Six hours at 85–94%, varied enough not to be consistent.
    const busyDay = Array.from({ length: 36 }, (_, i) => 85 + (i % 2) * 9);

    it('is not reported on its own', () => {
      expect(detect(tracked(`${MON}T08:00:00Z`, busyDay))).toEqual([]);
    });

    it('is reported alongside a main rule the same day', () => {
      const rules = detect(
        tracked(`${MON}T08:00:00Z`, busyDay),
        tracked(`${MON}T16:00:00Z`, repeat(73, 4)),
      ).flatMap((instance) => instance.rules);

      expect(rules).toEqual(
        expect.arrayContaining([
          'breakless_work',
          'sustained_high_activity',
          'consistent_activity',
        ]),
      );
    });
  });

  describe("the member's own normal patterns", () => {
    it('are not flagged', () => {
      const findings = find(tracked(`${MON}T09:00:00Z`, repeat(73, 4)));

      expect(buildUnusualInstances(findings, ['consistent_activity'])).toEqual(
        [],
      );
    });

    it("don't raise another rule's severity", () => {
      // A flat 100% is normally highly unusual because two rules agree; if
      // flat activity is normal for this member, only 95%+ is left — and
      // 40 min is just past its 30-min minimum.
      const findings = find(tracked(`${MON}T09:00:00Z`, repeat(100, 4)));

      expect(
        buildUnusualInstances(findings, ['consistent_activity']),
      ).toMatchObject([
        { severity: 'slightly_unusual', rules: ['high_activity'] },
      ]);
    });

    it('leave supporting rules with nothing to support', () => {
      const busyDay = Array.from({ length: 36 }, (_, i) => 85 + (i % 2) * 9);
      const findings = find(
        tracked(`${MON}T08:00:00Z`, busyDay),
        tracked(`${MON}T16:00:00Z`, repeat(73, 4)),
      );

      expect(buildUnusualInstances(findings, ['consistent_activity'])).toEqual(
        [],
      );
    });
  });
});

describe('normalRulesFor', () => {
  const on = (date: string, rule: UnusualRule): UnusualFinding => ({
    date,
    rule,
    start: Date.parse(`${date}T09:00:00Z`),
    end: Date.parse(`${date}T10:00:00Z`),
    reason: '',
  });

  it('treats a rule seen on 5 or more days as the member’s norm', () => {
    const baseline = ['01', '02', '03', '04', '05'].map((d) =>
      on(`2026-03-${d}`, 'consistent_activity'),
    );
    expect(normalRulesFor(baseline)).toEqual(['consistent_activity']);
  });

  it('counts days, not findings', () => {
    const baseline = Array.from({ length: 6 }, () =>
      on('2026-03-01', 'high_activity'),
    );
    expect(normalRulesFor(baseline)).toEqual([]);
  });
});

describe('affectedSecondsBySeverity', () => {
  it('counts overlapping instances of a severity once', () => {
    const instance = (
      start: string,
      end: string,
      severity: UnusualInstance['severity'],
    ): UnusualInstance => ({
      date: MON,
      start,
      end,
      durationSeconds: 0,
      severity,
      rules: ['high_activity'],
      reasons: [],
    });

    expect(
      affectedSecondsBySeverity([
        instance(`${MON}T09:00:00Z`, `${MON}T10:00:00Z`, 'highly_unusual'),
        instance(`${MON}T09:30:00Z`, `${MON}T10:30:00Z`, 'highly_unusual'),
        instance(`${MON}T14:00:00Z`, `${MON}T14:40:00Z`, 'slightly_unusual'),
      ]),
    ).toEqual({ highly_unusual: 5400, unusual: 0, slightly_unusual: 2400 });
  });
});

describe('formatSpan', () => {
  it('reads like a person would say it', () => {
    expect(formatSpan(45 * 60 * 1000)).toBe('45 min');
    expect(formatSpan(2 * 60 * 60 * 1000)).toBe('2 h');
    expect(formatSpan(70 * 60 * 1000)).toBe('1 h 10 min');
  });
});
