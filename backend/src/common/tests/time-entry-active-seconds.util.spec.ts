import {
  buildPauseStates,
  computeActiveSeconds,
} from '../time-entry-active-seconds.util';
import { TimeEntry } from '../../database/entities/time-entry.entity';
import { TimeEntryPause } from '../../database/entities/time-entry-pause.entity';

const NOW = new Date('2026-10-06T12:00:00.000Z');

function entry(startedAt: string, endedAt: string | null): TimeEntry {
  return {
    id: 'te-1',
    startedAt: new Date(startedAt),
    endedAt: endedAt ? new Date(endedAt) : null,
  } as TimeEntry;
}

function pause(pausedAt: string, resumedAt: string | null): TimeEntryPause {
  return {
    timeEntryId: 'te-1',
    pausedAt: new Date(pausedAt),
    resumedAt: resumedAt ? new Date(resumedAt) : null,
  } as TimeEntryPause;
}

describe('buildPauseStates', () => {
  it('sums ordinary closed spans', () => {
    const states = buildPauseStates([
      pause('2026-10-06T09:00:00.000Z', '2026-10-06T09:10:00.000Z'),
      pause('2026-10-06T10:00:00.000Z', '2026-10-06T10:05:00.000Z'),
    ]);

    expect(states.get('te-1')?.pausedSeconds).toBe(900);
  });

  /**
   * The bug this exists for. A span that resumes before it was paused used
   * to be summed as negative, which *subtracts* from paused time and so
   * inflates the entry's duration — reporting work that never happened.
   * One such row turned 13 minutes of tracked time into 1h16m.
   */
  it('counts a span that resumes before it starts as nothing, never negative', () => {
    const states = buildPauseStates([
      pause('2026-10-06T11:07:10.000Z', '2026-10-06T10:03:51.000Z'),
    ]);

    expect(states.get('te-1')?.pausedSeconds).toBe(0);
  });

  it('does not let a backwards span cancel out a real one', () => {
    const states = buildPauseStates([
      pause('2026-10-06T00:00:00.000Z', '2026-10-06T09:50:42.000Z'),
      pause('2026-10-06T11:07:10.000Z', '2026-10-06T10:03:51.000Z'),
    ]);

    // The real pause alone, with the impossible one contributing nothing.
    expect(states.get('te-1')?.pausedSeconds).toBe(35442);
  });

  it('reports an open span separately from the closed total', () => {
    const states = buildPauseStates([
      pause('2026-10-06T09:00:00.000Z', '2026-10-06T09:10:00.000Z'),
      pause('2026-10-06T11:00:00.000Z', null),
    ]);

    expect(states.get('te-1')?.pausedSeconds).toBe(600);
    expect(states.get('te-1')?.pausedAt).toEqual(
      new Date('2026-10-06T11:00:00.000Z'),
    );
  });
});

describe('computeActiveSeconds', () => {
  // The real entry from the timesheet: paused from the moment it started
  // until 09:50, then worked for thirteen minutes.
  it('nets a long pause off the span', () => {
    const states = buildPauseStates([
      pause('2026-10-06T00:00:00.000Z', '2026-10-06T09:50:42.000Z'),
      pause('2026-10-06T11:07:10.000Z', '2026-10-06T10:03:51.000Z'),
    ]);

    const seconds = computeActiveSeconds(
      entry('2026-10-06T00:00:00.000Z', '2026-10-06T10:03:51.000Z'),
      states,
      NOW,
    );

    expect(seconds).toBe(789);
  });

  it('never reports negative active time', () => {
    const states = buildPauseStates([
      pause('2026-10-06T09:00:00.000Z', '2026-10-06T23:00:00.000Z'),
    ]);

    const seconds = computeActiveSeconds(
      entry('2026-10-06T09:00:00.000Z', '2026-10-06T10:00:00.000Z'),
      states,
      NOW,
    );

    expect(seconds).toBe(0);
  });
});
