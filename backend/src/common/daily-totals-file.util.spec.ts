import {
  buildDailyTotalsCsv,
  buildDailyTotalsTable,
} from './daily-totals-file.util';

const entry = (
  projectId: string | null,
  startedAt: string,
  durationSeconds: number | null,
  membershipId = 'm-1',
) => {
  const start = new Date(startedAt);
  return {
    id: `${membershipId}-${projectId}-${startedAt}`,
    membershipId,
    projectId,
    projectName: projectId === null ? null : `Project ${projectId}`,
    startedAt: start,
    endedAt:
      durationSeconds === null
        ? null
        : new Date(start.getTime() + durationSeconds * 1000),
    pauses: [],
    durationSeconds,
  };
};

describe('buildDailyTotalsTable', () => {
  it('makes a column per day and sums per project and day', () => {
    const table = buildDailyTotalsTable(
      [
        entry('a', '2026-10-01T09:00:00Z', 3600),
        entry('a', '2026-10-01T12:00:00Z', 1800),
        entry('b', '2026-10-03T09:00:00Z', 60),
      ],
      '2026-10-01',
      '2026-10-03',
      'UTC',
    );
    expect(table.header).toHaveLength(5);
    expect(table.body[0]).toEqual([
      'Project a',
      '01:30:00',
      '-',
      '-',
      '01:30:00',
    ]);
    expect(table.body[2]).toEqual([
      'Daily total',
      '01:30:00',
      '-',
      '00:01:00',
      '01:31:00',
    ]);
  });

  it('reads days on the zone clock and skips running entries', () => {
    const table = buildDailyTotalsTable(
      [
        entry('a', '2026-10-01T22:00:00Z', 3600),
        entry('b', '2026-10-01T09:00:00Z', null),
      ],
      '2026-10-01',
      '2026-10-02',
      'Africa/Nairobi',
    );
    expect(table.body).toHaveLength(2);
    expect(table.body[0].slice(1)).toEqual(['-', '01:00:00', '01:00:00']);
  });

  // ADR-0022: a person may track on two Devices at once, and the hours
  // they share count once.
  it('counts an hour tracked on two devices at once as one hour', () => {
    const table = buildDailyTotalsTable(
      [
        entry('a', '2026-10-01T09:00:00Z', 3600),
        entry('a', '2026-10-01T09:00:00Z', 3600),
      ],
      '2026-10-01',
      '2026-10-01',
      'UTC',
    );
    expect(table.body).toEqual([
      ['Project a', '01:00:00', '01:00:00'],
      ['Daily total', '01:00:00', '01:00:00'],
    ]);
  });

  it('still adds up two people who worked the same hour', () => {
    const table = buildDailyTotalsTable(
      [
        entry('a', '2026-10-01T09:00:00Z', 3600, 'm-1'),
        entry('a', '2026-10-01T09:00:00Z', 3600, 'm-2'),
      ],
      '2026-10-01',
      '2026-10-01',
      'UTC',
    );
    expect(table.body).toEqual([
      ['Project a', '02:00:00', '02:00:00'],
      ['Daily total', '02:00:00', '02:00:00'],
    ]);
  });

  it('credits time shared by two projects to one, so rows add up to the total', () => {
    const table = buildDailyTotalsTable(
      [
        entry('a', '2026-10-01T09:00:00Z', 3600),
        entry('b', '2026-10-01T09:30:00Z', 3600),
      ],
      '2026-10-01',
      '2026-10-01',
      'UTC',
    );
    // Equal hours each: the tie goes to the one that started first.
    expect(table.body).toEqual([
      ['Project a', '01:00:00', '01:00:00'],
      ['Project b', '00:30:00', '00:30:00'],
      ['Daily total', '01:30:00', '01:30:00'],
    ]);
  });

  it('gives "No project" only the time no project covers', () => {
    const table = buildDailyTotalsTable(
      [
        entry('a', '2026-10-01T09:00:00Z', 3600),
        entry(null, '2026-10-01T09:30:00Z', 3600),
      ],
      '2026-10-01',
      '2026-10-01',
      'UTC',
    );
    expect(table.body).toEqual([
      ['No project', '00:30:00', '00:30:00'],
      ['Project a', '01:00:00', '01:00:00'],
      ['Daily total', '01:30:00', '01:30:00'],
    ]);
  });

  it('counts a paused stretch on one device when another kept tracking', () => {
    const paused = {
      ...entry('a', '2026-10-01T09:00:00Z', 1800),
      endedAt: new Date('2026-10-01T10:00:00Z'),
      pauses: [
        {
          pausedAt: new Date('2026-10-01T09:15:00Z'),
          resumedAt: new Date('2026-10-01T09:45:00Z'),
        },
      ],
    };
    const table = buildDailyTotalsTable(
      [paused, entry('a', '2026-10-01T09:00:00Z', 3600)],
      '2026-10-01',
      '2026-10-01',
      'UTC',
    );
    expect(table.body.at(-1)).toEqual(['Daily total', '01:00:00', '01:00:00']);
  });

  // Rows like this exist (see `closeOpenPause`): it must not make the entry
  // look like it overlaps itself.
  it('keeps the duration of an entry whose pause resumes before it began', () => {
    const backwards = {
      ...entry('a', '2026-10-01T09:00:00Z', 3599),
      endedAt: new Date('2026-10-01T10:00:00Z'),
      pauses: [
        {
          pausedAt: new Date('2026-10-01T09:30:00Z'),
          resumedAt: new Date('2026-10-01T09:20:00Z'),
        },
      ],
    };
    const table = buildDailyTotalsTable(
      [backwards],
      '2026-10-01',
      '2026-10-01',
      'UTC',
    );
    expect(table.body.at(-1)).toEqual(['Daily total', '00:59:59', '00:59:59']);
  });

  it('guards CSV formula cells', () => {
    const csv = buildDailyTotalsCsv({ header: ['P'], body: [['=SUM(1)']] });
    expect(csv).toBe("P\r\n'=SUM(1)");
  });
});
