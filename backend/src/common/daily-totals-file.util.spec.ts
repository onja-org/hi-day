import {
  buildDailyTotalsCsv,
  buildDailyTotalsTable,
} from './daily-totals-file.util';

const entry = (
  projectId: string,
  startedAt: string,
  durationSeconds: number | null,
) => ({
  projectId,
  projectName: `Project ${projectId}`,
  startedAt: new Date(startedAt),
  durationSeconds,
});

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

  it('guards CSV formula cells', () => {
    const csv = buildDailyTotalsCsv({ header: ['P'], body: [['=SUM(1)']] });
    expect(csv).toBe("P\r\n'=SUM(1)");
  });
});
