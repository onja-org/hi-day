import { TimeEntryType } from '../../database/entities/time-entry-type.enum';
import { buildTimelineDays, DayBounds } from '../timeline.util';

const day = (date: string): DayBounds => ({
  date,
  start: new Date(`${date}T00:00:00Z`),
  end: new Date(new Date(`${date}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000),
});

const entry = (
  id: string,
  startedAt: string,
  endedAt: string | null,
  type: TimeEntryType = TimeEntryType.NORMAL,
  idleSeconds: number | null = null,
) => ({
  id,
  startedAt: new Date(startedAt),
  endedAt: endedAt ? new Date(endedAt) : null,
  type,
  idleSeconds,
});

const sample = (from: string, to: string, activePercentage: number) => ({
  periodStart: new Date(from),
  periodEnd: new Date(to),
  activePercentage,
});

const now = new Date('2026-03-12T12:00:00Z');

describe('buildTimelineDays', () => {
  it('returns an empty row for a day with nothing tracked', () => {
    const [result] = buildTimelineDays(
      [day('2026-03-10')],
      [],
      new Map(),
      [],
      now,
    );

    expect(result).toEqual({
      date: '2026-03-10',
      segments: [],
      trackedSeconds: 0,
      manualSeconds: 0,
      idleSeconds: 0,
      activePercentage: null,
    });
  });

  it('labels each entry by its type', () => {
    const [result] = buildTimelineDays(
      [day('2026-03-10')],
      [
        entry('a', '2026-03-10T09:00:00Z', '2026-03-10T10:00:00Z'),
        entry(
          'b',
          '2026-03-10T10:00:00Z',
          '2026-03-10T10:30:00Z',
          TimeEntryType.MANUAL,
        ),
        entry(
          'c',
          '2026-03-10T11:00:00Z',
          '2026-03-10T11:15:00Z',
          TimeEntryType.IDLE,
        ),
      ],
      new Map(),
      [],
      now,
    );

    expect(result.segments.map((segment) => segment.kind)).toEqual([
      'tracked',
      'manual',
      'idle',
    ]);
    expect(result.trackedSeconds).toBe(3600);
    expect(result.manualSeconds).toBe(1800);
    expect(result.idleSeconds).toBe(900);
  });

  it('nets pauses out of tracked time', () => {
    const [result] = buildTimelineDays(
      [day('2026-03-10')],
      [entry('a', '2026-03-10T09:00:00Z', '2026-03-10T11:00:00Z')],
      new Map([
        [
          'a',
          [
            {
              pausedAt: new Date('2026-03-10T10:00:00Z'),
              resumedAt: new Date('2026-03-10T10:30:00Z'),
            },
          ],
        ],
      ]),
      [],
      now,
    );

    expect(result.segments).toHaveLength(2);
    expect(result.trackedSeconds).toBe(5400);
  });

  it('splits a resumed entry into its kept idle slice and tracked time', () => {
    const [result] = buildTimelineDays(
      [day('2026-03-10')],
      [
        entry(
          'a',
          '2026-03-10T09:00:00Z',
          '2026-03-10T10:00:00Z',
          TimeEntryType.RESUMED,
          600,
        ),
      ],
      new Map(),
      [],
      now,
    );

    expect(result.segments.map((segment) => segment.kind)).toEqual([
      'idle',
      'tracked',
    ]);
    expect(result.idleSeconds).toBe(600);
    expect(result.trackedSeconds).toBe(3000);
  });

  it('cuts an entry spanning midnight across both days', () => {
    const results = buildTimelineDays(
      [day('2026-03-10'), day('2026-03-11')],
      [entry('a', '2026-03-10T23:00:00Z', '2026-03-11T01:00:00Z')],
      new Map(),
      [],
      now,
    );

    expect(results.map((result) => result.trackedSeconds)).toEqual([
      3600, 3600,
    ]);
  });

  it('runs an open entry up to now', () => {
    const [result] = buildTimelineDays(
      [day('2026-03-12')],
      [entry('a', '2026-03-12T11:00:00Z', null)],
      new Map(),
      [],
      now,
    );

    expect(result.trackedSeconds).toBe(3600);
  });

  it('weights activity over tracked time only', () => {
    const [result] = buildTimelineDays(
      [day('2026-03-10')],
      [
        entry('a', '2026-03-10T09:00:00Z', '2026-03-10T09:20:00Z'),
        entry(
          'b',
          '2026-03-10T10:00:00Z',
          '2026-03-10T11:00:00Z',
          TimeEntryType.MANUAL,
        ),
      ],
      new Map(),
      [
        sample('2026-03-10T09:00:00Z', '2026-03-10T09:10:00Z', 80),
        sample('2026-03-10T09:10:00Z', '2026-03-10T09:20:00Z', 40),
        // Against manual time: no input to measure, so ignored.
        sample('2026-03-10T10:00:00Z', '2026-03-10T10:10:00Z', 0),
      ],
      now,
    );

    expect(result.activePercentage).toBe(60);
    expect(result.segments[0].activePercentage).toBe(60);
    expect(result.segments[1].activePercentage).toBeNull();
  });

  it('counts time shared by two Devices once', () => {
    const [result] = buildTimelineDays(
      [day('2026-03-10')],
      [
        entry('a', '2026-03-10T09:00:00Z', '2026-03-10T10:00:00Z'),
        entry('b', '2026-03-10T09:30:00Z', '2026-03-10T10:30:00Z'),
      ],
      new Map(),
      [],
      now,
    );

    expect(result.trackedSeconds).toBe(5400);
  });
});
