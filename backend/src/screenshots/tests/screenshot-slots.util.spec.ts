import {
  activityIn,
  clipTo,
  dominantProjectIn,
  slotsBetween,
  weightedAverage,
  workedSecondsIn,
} from '../screenshot-slots.util';

const at = (iso: string) => new Date(iso).getTime();
const slot = (from: string, to: string) => ({ start: at(from), end: at(to) });

describe('screenshot slots', () => {
  describe('slotsBetween', () => {
    it('cuts an ordinary day into 144 ten-minute slots', () => {
      const slots = slotsBetween(
        new Date('2026-03-10T00:00:00Z'),
        new Date('2026-03-11T00:00:00Z'),
      );

      expect(slots).toHaveLength(144);
      expect(slots[0]).toEqual(
        slot('2026-03-10T00:00:00Z', '2026-03-10T00:10:00Z'),
      );
    });

    // A day is 23 or 25 hours across a DST change, so the count is whatever
    // fits rather than a fixed 144.
    it('follows a short day rather than assuming 24 hours', () => {
      const slots = slotsBetween(
        new Date('2026-03-10T00:00:00Z'),
        new Date('2026-03-10T23:00:00Z'),
      );

      expect(slots).toHaveLength(138);
    });

    // Some zones shift by 30 or 45 minutes, leaving a part-slot at the end.
    it('clips the last slot to the end of the day', () => {
      const slots = slotsBetween(
        new Date('2026-03-10T00:00:00Z'),
        new Date('2026-03-10T00:25:00Z'),
      );

      expect(slots).toHaveLength(3);
      expect(slots[2]).toEqual(
        slot('2026-03-10T00:20:00Z', '2026-03-10T00:25:00Z'),
      );
    });
  });

  describe('workedSecondsIn', () => {
    it('counts only the part of a stretch inside the slot', () => {
      const worked = workedSecondsIn(
        [slot('2026-03-10T08:55:00Z', '2026-03-10T09:05:00Z')],
        slot('2026-03-10T09:00:00Z', '2026-03-10T09:10:00Z'),
      );

      expect(worked).toBe(300);
    });

    // Two devices tracking the same stretch is one stretch worked, not two
    // (ADR-0022) — the slot total has to agree with the timesheet's.
    it('counts a stretch tracked on two devices once', () => {
      const worked = workedSecondsIn(
        [
          slot('2026-03-10T09:00:00Z', '2026-03-10T09:10:00Z'),
          slot('2026-03-10T09:00:00Z', '2026-03-10T09:10:00Z'),
        ],
        slot('2026-03-10T09:00:00Z', '2026-03-10T09:10:00Z'),
      );

      expect(worked).toBe(600);
    });

    it('is zero for a slot nothing overlaps', () => {
      const worked = workedSecondsIn(
        [slot('2026-03-10T11:00:00Z', '2026-03-10T12:00:00Z')],
        slot('2026-03-10T09:00:00Z', '2026-03-10T09:10:00Z'),
      );

      expect(worked).toBe(0);
    });
  });

  describe('activityIn', () => {
    // Periods are not clock-aligned: the agent starts one when the timer
    // starts ticking, so a slot rarely lines up with "its" sample.
    it('weights an unaligned sample by its overlap with the slot', () => {
      const result = activityIn(
        [
          {
            periodStart: new Date('2026-03-10T09:03:00Z'),
            periodEnd: new Date('2026-03-10T09:13:00Z'),
            activePercentage: 90,
          },
        ],
        slot('2026-03-10T09:00:00Z', '2026-03-10T09:10:00Z'),
      );

      // 09:03–09:10 is inside the slot: seven of its ten minutes.
      expect(result.activePercentage).toBe(90);
      expect(result.measuredSeconds).toBe(420);
    });

    it('averages two samples by how much of each falls inside', () => {
      const result = activityIn(
        [
          {
            periodStart: new Date('2026-03-10T08:55:00Z'),
            periodEnd: new Date('2026-03-10T09:05:00Z'),
            activePercentage: 100,
          },
          {
            periodStart: new Date('2026-03-10T09:05:00Z'),
            periodEnd: new Date('2026-03-10T09:15:00Z'),
            activePercentage: 50,
          },
        ],
        slot('2026-03-10T09:00:00Z', '2026-03-10T09:10:00Z'),
      );

      // Five minutes at 100% and five at 50%.
      expect(result.activePercentage).toBe(75);
      expect(result.measuredSeconds).toBe(600);
    });

    // "Nothing was measured" is a different claim from "they did nothing".
    it('reports null rather than zero for an unmeasured slot', () => {
      const result = activityIn(
        [],
        slot('2026-03-10T09:00:00Z', '2026-03-10T09:10:00Z'),
      );

      expect(result.activePercentage).toBeNull();
      expect(result.measuredSeconds).toBe(0);
    });
  });

  describe('dominantProjectIn', () => {
    it('picks the project most of the slot was spent on', () => {
      const project = dominantProjectIn(
        [
          {
            ...slot('2026-03-10T09:00:00Z', '2026-03-10T09:02:00Z'),
            projectId: 'a',
          },
          {
            ...slot('2026-03-10T09:02:00Z', '2026-03-10T09:10:00Z'),
            projectId: 'b',
          },
        ],
        slot('2026-03-10T09:00:00Z', '2026-03-10T09:10:00Z'),
      );

      expect(project).toBe('b');
    });

    it('is null when the time was tracked against no project', () => {
      const project = dominantProjectIn(
        [
          {
            ...slot('2026-03-10T09:00:00Z', '2026-03-10T09:10:00Z'),
            projectId: null,
          },
        ],
        slot('2026-03-10T09:00:00Z', '2026-03-10T09:10:00Z'),
      );

      expect(project).toBeNull();
    });
  });

  describe('weightedAverage', () => {
    it('weights each part by its measured time, not by count', () => {
      expect(
        weightedAverage([
          { activePercentage: 90, measuredSeconds: 600 },
          { activePercentage: 10, measuredSeconds: 120 },
        ]),
      ).toBe(77);
    });

    it('ignores parts with nothing measured', () => {
      expect(
        weightedAverage([
          { activePercentage: 80, measuredSeconds: 600 },
          { activePercentage: null, measuredSeconds: 0 },
        ]),
      ).toBe(80);
    });

    it('is null when nothing at all was measured', () => {
      expect(
        weightedAverage([{ activePercentage: null, measuredSeconds: 0 }]),
      ).toBeNull();
    });
  });

  describe('clipTo', () => {
    it('drops an interval entirely outside the window', () => {
      expect(
        clipTo(
          [slot('2026-03-10T07:00:00Z', '2026-03-10T08:00:00Z')],
          slot('2026-03-10T09:00:00Z', '2026-03-10T09:10:00Z'),
        ),
      ).toEqual([]);
    });
  });
});
