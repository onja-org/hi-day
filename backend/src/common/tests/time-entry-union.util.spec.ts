import { TimeEntry } from '../../database/entities/time-entry.entity';
import { TimeEntryPause } from '../../database/entities/time-entry-pause.entity';
import {
  activeIntervals,
  mergeIntervals,
  unionActiveSeconds,
  unionSeconds,
} from '../time-entry-union.util';

const NOW = new Date('2026-01-01T12:00:00.000Z');
const at = (hhmm: string): Date => new Date(`2026-01-01T${hhmm}:00.000Z`);

function entry(id: string, start: string, end: string | null): TimeEntry {
  return {
    id,
    startedAt: at(start),
    endedAt: end === null ? null : at(end),
  } as TimeEntry;
}

function pause(
  timeEntryId: string,
  from: string,
  to: string | null,
): TimeEntryPause {
  return {
    timeEntryId,
    pausedAt: at(from),
    resumedAt: to === null ? null : at(to),
  } as TimeEntryPause;
}

describe('mergeIntervals', () => {
  it('merges overlapping ranges into one', () => {
    expect(
      mergeIntervals([
        { start: 0, end: 10 },
        { start: 5, end: 15 },
      ]),
    ).toEqual([{ start: 0, end: 15 }]);
  });

  it('treats touching ranges as continuous, not as a gap', () => {
    expect(
      mergeIntervals([
        { start: 0, end: 10 },
        { start: 10, end: 20 },
      ]),
    ).toEqual([{ start: 0, end: 20 }]);
  });

  it('keeps genuinely separate ranges apart', () => {
    expect(
      mergeIntervals([
        { start: 0, end: 10 },
        { start: 20, end: 30 },
      ]),
    ).toHaveLength(2);
  });

  it('is order-independent', () => {
    expect(
      mergeIntervals([
        { start: 20, end: 30 },
        { start: 0, end: 10 },
      ]),
    ).toEqual([
      { start: 0, end: 10 },
      { start: 20, end: 30 },
    ]);
  });
});

describe('activeIntervals — pauses carve holes', () => {
  it('splits an entry around a closed pause', () => {
    const result = activeIntervals(
      entry('e1', '09:00', '12:00'),
      [pause('e1', '10:00', '11:00')],
      NOW,
    );
    expect(result).toEqual([
      { start: at('09:00').getTime(), end: at('10:00').getTime() },
      { start: at('11:00').getTime(), end: at('12:00').getTime() },
    ]);
  });

  it('ends the entry at an open pause — it never resumed', () => {
    const result = activeIntervals(
      entry('e1', '09:00', null),
      [pause('e1', '10:00', null)],
      NOW,
    );
    expect(result).toEqual([
      { start: at('09:00').getTime(), end: at('10:00').getTime() },
    ]);
  });

  it('runs a still-open entry up to now', () => {
    const result = activeIntervals(entry('e1', '09:00', null), [], NOW);
    expect(result).toEqual([
      { start: at('09:00').getTime(), end: NOW.getTime() },
    ]);
  });
});

/**
 * The rule this whole change exists for: a Membership may track on several
 * Devices at once, and their shared wall-clock time must count once.
 */
describe('unionActiveSeconds — two devices, one person', () => {
  it('counts fully overlapping devices as one hour, not two', () => {
    const seconds = unionActiveSeconds(
      [entry('laptop', '09:00', '10:00'), entry('desktop', '09:00', '10:00')],
      new Map(),
      NOW,
    );
    expect(seconds).toBe(3600);
  });

  it('counts partial overlap once', () => {
    const seconds = unionActiveSeconds(
      [entry('laptop', '09:00', '10:00'), entry('desktop', '09:30', '11:00')],
      new Map(),
      NOW,
    );
    expect(seconds).toBe(7200); // 09:00–11:00
  });

  it('still adds up genuinely separate stretches', () => {
    const seconds = unionActiveSeconds(
      [entry('laptop', '09:00', '10:00'), entry('desktop', '14:00', '15:00')],
      new Map(),
      NOW,
    );
    expect(seconds).toBe(7200);
  });

  /**
   * A pause on one Device must not erase time another Device is genuinely
   * tracking — the person was working, on the machine that stayed running.
   */
  it('keeps time one device paused while the other kept tracking', () => {
    const seconds = unionActiveSeconds(
      [entry('laptop', '09:00', '10:00'), entry('desktop', '09:00', '10:00')],
      new Map([['laptop', [pause('laptop', '09:15', '09:30')]]]),
      NOW,
    );
    expect(seconds).toBe(3600);
  });

  it('drops time both devices were paused for', () => {
    const seconds = unionActiveSeconds(
      [entry('laptop', '09:00', '10:00'), entry('desktop', '09:00', '10:00')],
      new Map([
        ['laptop', [pause('laptop', '09:15', '09:30')]],
        ['desktop', [pause('desktop', '09:15', '09:30')]],
      ]),
      NOW,
    );
    expect(seconds).toBe(2700); // one hour less the shared quarter
  });

  it('is zero for no entries', () => {
    expect(unionActiveSeconds([], new Map(), NOW)).toBe(0);
  });
});

describe('unionSeconds', () => {
  it('never returns a negative total', () => {
    expect(unionSeconds([{ start: 100, end: 50 }])).toBe(0);
  });
});
