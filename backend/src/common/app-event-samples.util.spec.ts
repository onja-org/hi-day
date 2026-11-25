import {
  APP_EVENT_RUN_LOOKBACK_MS,
  expandAppEventSamples,
  runLookbackStart,
  sampleCountOf,
} from './app-event-samples.util';

const at = (time: string) => new Date(`2026-09-08T${time}.000Z`);

describe('app-event-samples.util', () => {
  describe('expandAppEventSamples', () => {
    it('expands a run into one sample every 5 s, in order', () => {
      const samples = expandAppEventSamples([
        { appName: 'Figma', sampledAt: at('09:00:00'), sampleCount: 3 },
      ]);

      expect(samples).toEqual([
        { appName: 'Figma', sampledAt: at('09:00:00'), sampleCount: 1 },
        { appName: 'Figma', sampledAt: at('09:00:05'), sampleCount: 1 },
        { appName: 'Figma', sampledAt: at('09:00:10'), sampleCount: 1 },
      ]);
    });

    it('reads a row without sampleCount (written before runs existed) as one sample', () => {
      expect(
        expandAppEventSamples([{ sampledAt: at('09:00:00') }]),
      ).toHaveLength(1);
      expect(
        expandAppEventSamples([
          { sampledAt: at('09:00:00'), sampleCount: null },
        ]),
      ).toHaveLength(1);
    });

    it('keeps only samples inside the window, inclusive at both ends', () => {
      const samples = expandAppEventSamples(
        [{ sampledAt: at('08:59:55'), sampleCount: 4 }],
        { start: at('09:00:00'), end: at('09:00:05') },
      );

      expect(samples.map((sample) => sample.sampledAt)).toEqual([
        at('09:00:00'),
        at('09:00:05'),
      ]);
    });
  });

  describe('sampleCountOf', () => {
    it('never reads less than one', () => {
      expect(sampleCountOf({ sampledAt: at('09:00:00'), sampleCount: 0 })).toBe(
        1,
      );
      expect(
        sampleCountOf({ sampledAt: at('09:00:00'), sampleCount: -3 }),
      ).toBe(1);
      expect(
        sampleCountOf({ sampledAt: at('09:00:00'), sampleCount: 12 }),
      ).toBe(12);
    });
  });

  describe('runLookbackStart', () => {
    it('reaches back exactly as far as the longest run can start before a window', () => {
      expect(APP_EVENT_RUN_LOOKBACK_MS).toBe(59 * 5000);
      expect(runLookbackStart(at('09:00:00'))).toEqual(at('08:55:05'));
    });
  });
});
