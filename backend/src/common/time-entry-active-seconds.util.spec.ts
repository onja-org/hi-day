import { TimeEntryPause } from '../database/entities/time-entry-pause.entity';
import {
  NO_PAUSE_STATE,
  activeSeconds,
  resolvePauseStates,
} from './time-entry-active-seconds.util';

function pause(overrides: Partial<TimeEntryPause>): TimeEntryPause {
  return {
    id: `pause-${Math.random()}`,
    timeEntryId: 'entry-1',
    organisationId: 'org-1',
    resumedAt: null,
    ...overrides,
  } as TimeEntryPause;
}

describe('resolvePauseStates', () => {
  it('returns closed-pause seconds and no open pause when every span is resumed', () => {
    const states = resolvePauseStates([
      pause({
        pausedAt: new Date('2026-01-01T10:00:00Z'),
        resumedAt: new Date('2026-01-01T10:05:00Z'),
      }),
    ]);

    expect(states.get('entry-1')).toEqual({
      pausedAt: null,
      pausedSeconds: 300,
      spans: [
        {
          pausedAt: new Date('2026-01-01T10:00:00Z'),
          resumedAt: new Date('2026-01-01T10:05:00Z'),
        },
      ],
    });
  });

  it('reports the open pause instant separately from closed-pause seconds', () => {
    const states = resolvePauseStates([
      pause({
        pausedAt: new Date('2026-01-01T10:00:00Z'),
        resumedAt: new Date('2026-01-01T10:05:00Z'),
      }),
      pause({ pausedAt: new Date('2026-01-01T11:00:00Z'), resumedAt: null }),
    ]);

    const state = states.get('entry-1')!;
    expect(state.pausedAt).toEqual(new Date('2026-01-01T11:00:00Z'));
    expect(state.pausedSeconds).toBe(300);
    expect(state.spans).toHaveLength(2);
  });

  it('sorts spans oldest-first regardless of input order', () => {
    const states = resolvePauseStates([
      pause({
        pausedAt: new Date('2026-01-01T12:00:00Z'),
        resumedAt: new Date('2026-01-01T12:05:00Z'),
      }),
      pause({
        pausedAt: new Date('2026-01-01T10:00:00Z'),
        resumedAt: new Date('2026-01-01T10:05:00Z'),
      }),
    ]);

    const spans = states.get('entry-1')!.spans;
    expect(spans[0].pausedAt).toEqual(new Date('2026-01-01T10:00:00Z'));
    expect(spans[1].pausedAt).toEqual(new Date('2026-01-01T12:00:00Z'));
  });

  it('keys separately by entry when pauses belong to different entries', () => {
    const states = resolvePauseStates([
      pause({
        timeEntryId: 'entry-1',
        pausedAt: new Date('2026-01-01T10:00:00Z'),
        resumedAt: new Date('2026-01-01T10:05:00Z'),
      }),
      pause({
        timeEntryId: 'entry-2',
        pausedAt: new Date('2026-01-01T10:00:00Z'),
        resumedAt: new Date('2026-01-01T10:10:00Z'),
      }),
    ]);

    expect(states.get('entry-1')!.pausedSeconds).toBe(300);
    expect(states.get('entry-2')!.pausedSeconds).toBe(600);
  });
});

describe('activeSeconds', () => {
  const entry = {
    startedAt: new Date('2026-01-01T10:00:00Z'),
    endedAt: null as Date | null,
  };

  it('caps at "now" for a still-running, never-paused entry', () => {
    const now = new Date('2026-01-01T10:30:00Z');
    expect(activeSeconds(entry, NO_PAUSE_STATE, now)).toBe(1800);
  });

  it("caps at the entry's own endedAt once it's completed, ignoring now", () => {
    const completed = { ...entry, endedAt: new Date('2026-01-01T10:20:00Z') };
    const now = new Date('2026-01-01T12:00:00Z');
    expect(activeSeconds(completed, NO_PAUSE_STATE, now)).toBe(1200);
  });

  it('freezes at the pause instant while a pause is open, ignoring now', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const pausedState = {
      pausedAt: new Date('2026-01-01T10:10:00Z'),
      pausedSeconds: 0,
      spans: [],
    };
    expect(activeSeconds(entry, pausedState, now)).toBe(600);
  });

  it('subtracts closed-pause seconds from the gross elapsed time', () => {
    const completed = { ...entry, endedAt: new Date('2026-01-01T11:00:00Z') };
    const now = new Date('2026-01-01T11:00:00Z');
    const pausedState = { pausedAt: null, pausedSeconds: 300, spans: [] };
    expect(activeSeconds(completed, pausedState, now)).toBe(3300);
  });

  it('never goes negative even if pause seconds somehow exceed gross elapsed time', () => {
    const now = new Date('2026-01-01T10:05:00Z');
    const pausedState = { pausedAt: null, pausedSeconds: 10_000, spans: [] };
    expect(activeSeconds(entry, pausedState, now)).toBe(0);
  });
});
