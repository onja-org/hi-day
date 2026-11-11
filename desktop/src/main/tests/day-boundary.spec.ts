import { describe, expect, it } from 'vitest';
import {
  dayKey,
  startOfDay,
  startOfDayInZone,
  startOfLocalDay,
} from '../day-boundary';

/** What a zone's clock reads at an instant, for asserting on boundaries. */
function reads(at: Date, zone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(at);
}

const MACHINE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Offset in minutes of `zone` at `at`, east of UTC. */
function offsetMinutes(zone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(at);
  const get = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second'),
  );
  return (asUtc - at.getTime()) / 60_000;
}

/**
 * Real zones spanning the globe. Synthetic `Etc/GMT` names cannot stand in
 * here: they stop at +/-12 and a machine in Auckland needs +16.
 */
const ZONES = [
  'Pacific/Kiritimati',
  'Pacific/Auckland',
  'Asia/Tokyo',
  'Asia/Kolkata',
  'Indian/Antananarivo',
  'Europe/Berlin',
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'Pacific/Honolulu',
];

/** The instant the machine's own clock reads midday on 9 November 2026. */
function machineMidday(): Date {
  const noon = new Date(2026, 10, 9, 12, 0, 0);
  return noon;
}

/**
 * A zone `hours` from the machine's, or `null` where none is listed. Kept
 * within half a day so both are on the same calendar date at midday, which
 * is what makes "ahead" and "behind" mean anything: a zone far enough ahead
 * is on tomorrow's date, and its midnight is then *later*, not earlier.
 */
function zoneFromMachine(at: Date, hours: number): string | null {
  const machine = offsetMinutes(MACHINE, at);
  const wanted = machine + hours * 60;
  return (
    ZONES.find(
      (zone) =>
        offsetMinutes(zone, at) === wanted && Math.abs(hours) <= 11,
    ) ?? null
  );
}

describe('startOfDayInZone', () => {
  // One instant, two calendar days: 01:00 on the 10th in Antananarivo is
  // still 23:00 on the 9th in Berlin.
  it('lands on midnight as that zone reads it', () => {
    const at = new Date('2026-11-09T22:00:00.000Z');
    expect(
      reads(startOfDayInZone(at, 'Indian/Antananarivo'), 'Indian/Antananarivo'),
    ).toBe('10/11/2026, 00:00:00');
    expect(reads(startOfDayInZone(at, 'Europe/Berlin'), 'Europe/Berlin')).toBe(
      '09/11/2026, 00:00:00',
    );
  });

  /**
   * The reported shape: an organisation in Antananarivo, a laptop in
   * Berlin, tracking 23:00-01:00 on the organisation's clock. The two
   * zones are on different calendar days for the last hour of it.
   */
  describe('an Antananarivo organisation on a Berlin laptop', () => {
    // 23:00 and 01:00 Antananarivo (UTC+3) on the night of 9/10 November.
    const atElevenPm = new Date('2026-11-09T20:00:00.000Z');
    const atOneAm = new Date('2026-11-09T22:00:00.000Z');

    it('agrees with Berlin before the organisation s day rolls over', () => {
      expect(startOfDayInZone(atElevenPm, 'Indian/Antananarivo').toISOString()).toBe(
        '2026-11-08T21:00:00.000Z',
      );
      expect(startOfDayInZone(atElevenPm, 'Europe/Berlin').toISOString()).toBe(
        '2026-11-08T23:00:00.000Z',
      );
    });

    /** Two hours where the agent counting Berlin days is a day behind. */
    it('parts company once it does: 22 hours between the two windows', () => {
      const org = startOfDayInZone(atOneAm, 'Indian/Antananarivo');
      const machine = startOfDayInZone(atOneAm, 'Europe/Berlin');
      expect(org.toISOString()).toBe('2026-11-09T21:00:00.000Z');
      expect(machine.toISOString()).toBe('2026-11-08T23:00:00.000Z');
      expect((org.getTime() - machine.getTime()) / 3_600_000).toBe(22);
    });
  });

  describe('across a DST transition', () => {
    it('finds midnight on the day the clocks go forward', () => {
      const at = new Date('2026-03-29T12:00:00.000Z');
      const start = startOfDayInZone(at, 'Europe/Berlin');
      expect(reads(start, 'Europe/Berlin')).toBe('29/03/2026, 00:00:00');
      // Still CET at midnight; the hour goes at 02:00.
      expect(start.toISOString()).toBe('2026-03-28T23:00:00.000Z');
    });

    it('finds midnight on the day the clocks go back', () => {
      const at = new Date('2026-10-25T12:00:00.000Z');
      const start = startOfDayInZone(at, 'Europe/Berlin');
      expect(reads(start, 'Europe/Berlin')).toBe('25/10/2026, 00:00:00');
      expect(start.toISOString()).toBe('2026-10-24T22:00:00.000Z');
    });

    it('makes that day 25 hours long, so a boundary is never skipped', () => {
      const start = startOfDayInZone(new Date('2026-10-25T12:00:00.000Z'), 'Europe/Berlin');
      const next = startOfDayInZone(new Date('2026-10-26T12:00:00.000Z'), 'Europe/Berlin');
      expect((next.getTime() - start.getTime()) / 3_600_000).toBe(25);
    });

    /**
     * Santiago's DST begins at midnight, so that day has no 00:00 at all.
     * This lands an hour before the day rather than inside it — which is
     * what the server's own `startOfDayInZone` does, and matching it
     * matters more than being right alone.
     */
    it('lands an hour early where a zone skips its own midnight', () => {
      const start = startOfDayInZone(
        new Date('2026-09-06T15:00:00.000Z'),
        'America/Santiago',
      );
      expect(reads(start, 'America/Santiago')).toBe('05/09/2026, 23:00:00');
    });
  });

  describe('relative to whatever zone the machine is in', () => {
    const at = machineMidday();

    it('agrees with the machine for the machine s own zone', () => {
      expect(startOfDayInZone(at, MACHINE).getTime()).toBe(
        startOfLocalDay(at).getTime(),
      );
    });

    it('draws an earlier boundary for a zone ahead of the machine', () => {
      for (const hours of [1, 2, 3, 5, 9]) {
        const ahead = zoneFromMachine(at, hours);
        if (!ahead) continue;
        expect([ahead, startOfDayInZone(at, ahead).getTime()]).toEqual([
          ahead,
          startOfLocalDay(at).getTime() - hours * 3_600_000,
        ]);
      }
    });

    it('draws a later boundary for a zone behind the machine', () => {
      for (const hours of [1, 2, 3, 5, 9]) {
        const behind = zoneFromMachine(at, -hours);
        if (!behind) continue;
        expect([behind, startOfDayInZone(at, behind).getTime()]).toEqual([
          behind,
          startOfLocalDay(at).getTime() + hours * 3_600_000,
        ]);
      }
    });

    /** Whatever the zone, a day has begun and began less than a day ago. */
    it('never lands in the future or more than a day back', () => {
      for (const zone of ZONES) {
        const start = startOfDayInZone(at, zone).getTime();
        expect(start).toBeLessThanOrEqual(at.getTime());
        expect(at.getTime() - start).toBeLessThan(25 * 3_600_000);
      }
    });
  });
});

describe('startOfDay', () => {
  const at = new Date('2026-11-09T22:00:00.000Z');

  it('follows the organisation when its zone is known', () => {
    expect(startOfDay(at, 'Indian/Antananarivo').toISOString()).toBe(
      '2026-11-09T21:00:00.000Z',
    );
  });

  /** A backend too old to send one, or a launch that has reached nobody. */
  it('falls back to the machine when it is not', () => {
    expect(startOfDay(at, null).getTime()).toBe(startOfLocalDay(at).getTime());
    expect(startOfDay(at, undefined).getTime()).toBe(
      startOfLocalDay(at).getTime(),
    );
  });

  it('falls back rather than throwing on a zone this runtime cannot read', () => {
    expect(startOfDay(at, 'Mars/Olympus').getTime()).toBe(
      startOfLocalDay(at).getTime(),
    );
  });
});

describe('dayKey', () => {
  it('stamps the organisation s calendar day, not the machine s', () => {
    // 01:00 on the 10th in Antananarivo, still the 9th in Berlin.
    const at = new Date('2026-11-09T22:00:00.000Z');
    expect(dayKey(at, 'Indian/Antananarivo')).toBe('2026-11-10');
    expect(dayKey(at, 'Europe/Berlin')).toBe('2026-11-09');
  });

  it('falls back to the machine s day when no zone is known', () => {
    const at = new Date('2026-11-09T22:00:00.000Z');
    const local = startOfLocalDay(at);
    const pad = (n: number): string => String(n).padStart(2, '0');
    expect(dayKey(at, null)).toBe(
      `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`,
    );
  });
});
