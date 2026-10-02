import { attributeProjectSeconds } from '../project-attribution.util';
import { TimeEntry } from '../../database/entities/time-entry.entity';
import { TimeEntryPause } from '../../database/entities/time-entry-pause.entity';

const NOW = new Date('2026-01-05T18:00:00.000Z');
const HOUR = 3600;

function entry(
  id: string,
  projectId: string,
  startedAt: string,
  endedAt: string | null,
): TimeEntry {
  return {
    id,
    projectId,
    startedAt: new Date(startedAt),
    endedAt: endedAt ? new Date(endedAt) : null,
  } as TimeEntry;
}

const noPauses = new Map<string, TimeEntryPause[]>();

describe('attributeProjectSeconds', () => {
  it('leaves projects that never overlap exactly as they were tracked', () => {
    const seconds = attributeProjectSeconds(
      [
        entry('a', 'x', '2026-01-05T09:00:00.000Z', '2026-01-05T13:00:00.000Z'),
        entry('b', 'y', '2026-01-05T13:00:00.000Z', '2026-01-05T17:00:00.000Z'),
      ],
      noPauses,
      NOW,
    );

    expect(seconds.get('x')).toBe(4 * HOUR);
    expect(seconds.get('y')).toBe(4 * HOUR);
  });

  it('gives a fully shared day to one project rather than both', () => {
    const seconds = attributeProjectSeconds(
      [
        entry('a', 'x', '2026-01-05T09:00:00.000Z', '2026-01-05T17:00:00.000Z'),
        entry('b', 'y', '2026-01-05T09:00:00.000Z', '2026-01-05T17:00:00.000Z'),
      ],
      noPauses,
      NOW,
    );

    expect([...seconds.values()].reduce((a, b) => a + b, 0)).toBe(8 * HOUR);
  });

  it('charges a one-minute overlap one minute, not an afternoon', () => {
    const seconds = attributeProjectSeconds(
      [
        entry('a', 'x', '2026-01-05T09:00:00.000Z', '2026-01-05T13:00:00.000Z'),
        entry('b', 'y', '2026-01-05T12:59:00.000Z', '2026-01-05T17:00:00.000Z'),
      ],
      noPauses,
      NOW,
    );

    expect(seconds.get('y')).toBe(4 * HOUR + 60);
    expect(seconds.get('x')).toBe(4 * HOUR - 60);
    expect([...seconds.values()].reduce((a, b) => a + b, 0)).toBe(8 * HOUR);
  });

  it('breaks a tie by whichever project started first', () => {
    const seconds = attributeProjectSeconds(
      [
        entry(
          'a',
          'later',
          '2026-01-05T09:30:00.000Z',
          '2026-01-05T10:30:00.000Z',
        ),
        entry(
          'b',
          'earlier',
          '2026-01-05T09:00:00.000Z',
          '2026-01-05T10:00:00.000Z',
        ),
      ],
      noPauses,
      NOW,
    );

    expect(seconds.get('earlier')).toBe(HOUR);
    expect(seconds.get('later')).toBe(1800);
  });

  it('runs an unstopped entry up to now', () => {
    const seconds = attributeProjectSeconds(
      [entry('a', 'x', '2026-01-05T17:00:00.000Z', null)],
      noPauses,
      NOW,
    );

    expect(seconds.get('x')).toBe(HOUR);
  });

  it('excludes a pause from the time a project is credited with', () => {
    const pauses = new Map<string, TimeEntryPause[]>([
      [
        'a',
        [
          {
            pausedAt: new Date('2026-01-05T09:30:00.000Z'),
            resumedAt: new Date('2026-01-05T10:00:00.000Z'),
          } as TimeEntryPause,
        ],
      ],
    ]);
    const seconds = attributeProjectSeconds(
      [entry('a', 'x', '2026-01-05T09:00:00.000Z', '2026-01-05T11:00:00.000Z')],
      pauses,
      NOW,
    );

    expect(seconds.get('x')).toBe(90 * 60);
  });

  it('returns nothing for no entries', () => {
    expect(attributeProjectSeconds([], noPauses, NOW).size).toBe(0);
  });
});
