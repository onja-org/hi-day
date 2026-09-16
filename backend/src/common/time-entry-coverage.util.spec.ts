import {
  findEntryCovering,
  TimeEntryCoverageWindow,
} from './time-entry-coverage.util';

function entry(
  overrides: Partial<TimeEntryCoverageWindow> = {},
): TimeEntryCoverageWindow {
  return {
    id: 'e-1',
    projectId: 'p-1',
    startedAt: new Date('2026-01-05T09:00:00.000Z'),
    endedAt: new Date('2026-01-05T10:00:00.000Z'),
    ...overrides,
  };
}

describe('findEntryCovering', () => {
  it('returns the entry whose window contains the instant', () => {
    const entries = [entry()];

    expect(
      findEntryCovering(entries, new Date('2026-01-05T09:30:00.000Z')),
    ).toBe(entries[0]);
  });

  it('returns undefined for an instant covered by no entry', () => {
    const entries = [entry()];

    expect(
      findEntryCovering(entries, new Date('2026-01-05T11:00:00.000Z')),
    ).toBeUndefined();
  });

  it('treats a still-running entry (endedAt null) as covering everything from startedAt onward', () => {
    const entries = [
      entry({
        id: 'e-running',
        endedAt: null,
        startedAt: new Date('2026-01-05T09:00:00.000Z'),
      }),
    ];

    expect(
      findEntryCovering(entries, new Date('2026-01-06T03:00:00.000Z')),
    ).toBe(entries[0]);
  });

  it('covers an instant on the day after startedAt when the entry started the previous day and is still open', () => {
    const entries = [
      entry({
        id: 'e-overnight',
        startedAt: new Date('2026-01-04T22:00:00.000Z'),
        endedAt: null,
      }),
    ];

    expect(
      findEntryCovering(entries, new Date('2026-01-05T01:00:00.000Z')),
    ).toBe(entries[0]);
  });

  it('excludes the instant exactly at endedAt (end is exclusive)', () => {
    const entries = [entry({ endedAt: new Date('2026-01-05T10:00:00.000Z') })];

    expect(
      findEntryCovering(entries, new Date('2026-01-05T10:00:00.000Z')),
    ).toBeUndefined();
  });

  it('includes the instant exactly at startedAt (start is inclusive)', () => {
    const entries = [
      entry({ startedAt: new Date('2026-01-05T09:00:00.000Z') }),
    ];

    expect(
      findEntryCovering(entries, new Date('2026-01-05T09:00:00.000Z')),
    ).toBe(entries[0]);
  });
});
