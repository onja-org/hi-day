import {
  CountedPeriod,
  inputCountsIn,
  inputCountsOf,
  sumInputCounts,
} from './input-counts.util';

const at = (minute: number) =>
  new Date(Date.UTC(2026, 10, 10, 9, minute)).getTime();
const period = (
  fromMinute: number,
  toMinute: number,
  inputCounts: CountedPeriod['inputCounts'],
): CountedPeriod => ({
  periodStart: new Date(at(fromMinute)),
  periodEnd: new Date(at(toMinute)),
  inputCounts,
});
const counts = (
  keystrokes: number,
  mouseClicks: number,
  mouseMovement: number,
) => ({
  keystrokes,
  mouseClicks,
  mouseMovement,
});

describe('inputCountsIn', () => {
  it('takes a sample fully inside the window whole', () => {
    expect(
      inputCountsIn([period(0, 10, counts(300, 40, 9000))], {
        start: at(0),
        end: at(10),
      }),
    ).toEqual(counts(300, 40, 9000));
  });

  it('shares a sample between windows by how much of it each holds', () => {
    // 09:03-09:13, so 7 minutes fall in the 09:00 slot and 3 in the next.
    const samples = [period(3, 13, counts(100, 10, 1000))];

    expect(inputCountsIn(samples, { start: at(0), end: at(10) })).toEqual(
      counts(70, 7, 700),
    );
    expect(inputCountsIn(samples, { start: at(10), end: at(20) })).toEqual(
      counts(30, 3, 300),
    );
  });

  it('adds up every sample overlapping the window', () => {
    expect(
      inputCountsIn(
        [period(0, 5, counts(10, 1, 100)), period(5, 10, counts(20, 2, 200))],
        { start: at(0), end: at(10) },
      ),
    ).toEqual(counts(30, 3, 300));
  });

  it('is null, not zeros, when nothing overlapping could count', () => {
    expect(
      inputCountsIn([period(0, 10, null)], { start: at(0), end: at(10) }),
    ).toBeNull();
    expect(inputCountsIn([], { start: at(0), end: at(10) })).toBeNull();
  });

  it('keeps a real zero: input counted, none happened', () => {
    expect(
      inputCountsIn([period(0, 10, counts(0, 0, 0))], {
        start: at(0),
        end: at(10),
      }),
    ).toEqual(counts(0, 0, 0));
  });

  it('ignores samples outside the window', () => {
    expect(
      inputCountsIn([period(20, 30, counts(5, 5, 5))], {
        start: at(0),
        end: at(10),
      }),
    ).toBeNull();
  });
});

describe('inputCountsOf', () => {
  it('rebuilds the counts from the stored columns', () => {
    expect(
      inputCountsOf({ keystrokes: 1, mouseClicks: 2, mouseMovement: 3 }),
    ).toEqual(counts(1, 2, 3));
  });

  it('is null unless every column is set', () => {
    expect(
      inputCountsOf({ keystrokes: 1, mouseClicks: null, mouseMovement: 3 }),
    ).toBeNull();
  });
});

describe('sumInputCounts', () => {
  it('adds up the counted parts and skips the rest', () => {
    expect(sumInputCounts([counts(1, 2, 3), null, counts(10, 20, 30)])).toEqual(
      counts(11, 22, 33),
    );
  });

  it('is null when no part was counted', () => {
    expect(sumInputCounts([null, null])).toBeNull();
    expect(sumInputCounts([])).toBeNull();
  });
});
