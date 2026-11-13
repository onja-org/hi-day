import type { TimeEntryCoverageWindow } from '../../../common/time-entry-coverage.util';
import {
  labelKey,
  splitWorkTime,
  WorkLabels,
} from '../../work-classification.util';

const at = (time: string) => new Date(`2026-11-10T${time}:00.000Z`);

/** One reading every 5 seconds from `from`, in `appName`. */
function readings(appName: string, from: string, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    appName,
    sampledAt: new Date(at(from).getTime() + index * 5000),
  }));
}

const visit = (host: string, from: string, to: string) => ({
  host,
  startedAt: at(from),
  endedAt: at(to),
});

const entry = (from: string, to: string | null): TimeEntryCoverageWindow => ({
  id: from,
  projectId: null,
  startedAt: at(from),
  endedAt: to === null ? null : at(to),
});

const labels = (...pairs: [string, 'core' | 'non_core'][]): WorkLabels =>
  new Map(pairs);

const allDay = [entry('00:00', null)];

describe('splitWorkTime', () => {
  it('splits app time by label, five seconds a reading', () => {
    expect(
      splitWorkTime(
        [...readings('Code', '09:00', 12), ...readings('Spotify', '09:01', 6)],
        [],
        allDay,
        labels(
          [labelKey('app', 'Code'), 'core'],
          [labelKey('app', 'Spotify'), 'non_core'],
        ),
      ),
    ).toEqual({ coreSeconds: 60, nonCoreSeconds: 30, unclassifiedSeconds: 0 });
  });

  it('counts unlabelled apps as unclassified, never non-core', () => {
    expect(
      splitWorkTime(readings('Slack', '09:00', 4), [], allDay, labels()),
    ).toEqual({
      coreSeconds: 0,
      nonCoreSeconds: 0,
      unclassifiedSeconds: 20,
    });
  });

  it("uses the website's label while a site is open, not the browser's", () => {
    const split = splitWorkTime(
      readings('chrome', '09:00', 24),
      [
        visit('github.com', '09:00', '09:01'),
        visit('youtube.com', '09:01', '09:02'),
      ],
      allDay,
      labels(
        [labelKey('app', 'chrome'), 'non_core'],
        [labelKey('site', 'github.com'), 'core'],
        [labelKey('site', 'youtube.com'), 'non_core'],
      ),
    );

    expect(split).toEqual({
      coreSeconds: 60,
      nonCoreSeconds: 60,
      unclassifiedSeconds: 0,
    });
  });

  it("falls back to the browser's label when no site was recorded", () => {
    expect(
      splitWorkTime(
        readings('chrome', '09:00', 6),
        [],
        allDay,
        labels([labelKey('app', 'chrome'), 'core']),
      ),
    ).toEqual({ coreSeconds: 30, nonCoreSeconds: 0, unclassifiedSeconds: 0 });
  });

  it('leaves an unlabelled site unclassified even in a labelled browser', () => {
    expect(
      splitWorkTime(
        readings('chrome', '09:00', 6),
        [visit('example.com', '09:00', '09:01')],
        allDay,
        labels([labelKey('app', 'chrome'), 'core']),
      ),
    ).toEqual({ coreSeconds: 0, nonCoreSeconds: 0, unclassifiedSeconds: 30 });
  });

  it('only counts readings a time entry covers', () => {
    expect(
      splitWorkTime(
        // 08:59:00–09:00:55, of which only 09:00 onwards is on the timer.
        readings('Code', '08:59', 24),
        [],
        [entry('09:00', '09:10')],
        labels([labelKey('app', 'Code'), 'core']),
      ),
    ).toEqual({ coreSeconds: 60, nonCoreSeconds: 0, unclassifiedSeconds: 0 });
  });
});
