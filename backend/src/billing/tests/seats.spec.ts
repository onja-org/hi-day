import {
  billedSeatCount,
  isOverPurchasedSeats,
  MAX_PURCHASABLE_SEATS,
  parseSeatCount,
  seatsAreFull,
} from '../seats';

describe('billedSeatCount', () => {
  // Buying ahead of a hiring round is the point, so the purchase is a floor.
  it('bills the seats bought while there are fewer people than seats', () => {
    expect(billedSeatCount(10, 4)).toBe(10);
  });

  // Over-hiring is allowed and is not free: the invoice covers everyone.
  it('bills the people once there are more of them than seats', () => {
    expect(billedSeatCount(10, 14)).toBe(14);
  });

  it('bills the people where no seats were ever bought', () => {
    expect(billedSeatCount(null, 7)).toBe(7);
  });

  it('bills nothing for an organisation with nobody in it', () => {
    expect(billedSeatCount(null, 0)).toBe(0);
  });
});

describe('isOverPurchasedSeats', () => {
  it('is over only once the people outnumber the seats', () => {
    expect(isOverPurchasedSeats(5, 5)).toBe(false);
    expect(isOverPurchasedSeats(5, 6)).toBe(true);
  });

  // Nothing was promised, so nothing is exceeded — every trial is here.
  it('is never over where no seats were bought', () => {
    expect(isOverPurchasedSeats(null, 50)).toBe(false);
  });
});

describe('parseSeatCount', () => {
  it('takes a whole number of seats', () => {
    expect(parseSeatCount(1)).toBe(1);
    expect(parseSeatCount(250)).toBe(250);
  });

  it('refuses what nobody meant to buy', () => {
    expect(parseSeatCount(0)).toBeNull();
    expect(parseSeatCount(-3)).toBeNull();
    expect(parseSeatCount(2.5)).toBeNull();
    expect(parseSeatCount('4')).toBeNull();
    expect(parseSeatCount(null)).toBeNull();
    expect(parseSeatCount(Number.NaN)).toBeNull();
  });

  // Refused rather than clamped: a silently corrected typo would authorise
  // a charge nobody read.
  it('refuses a figure past the ceiling rather than clamping it', () => {
    expect(parseSeatCount(MAX_PURCHASABLE_SEATS)).toBe(MAX_PURCHASABLE_SEATS);
    expect(parseSeatCount(MAX_PURCHASABLE_SEATS + 1)).toBeNull();
  });
});

describe('seatsAreFull', () => {
  // The distinction from isOverPurchasedSeats, and the reason this exists:
  // consent has to be asked before the seat is exceeded, not after.
  it('is true at exactly the purchased count, where the next arrival costs', () => {
    expect(seatsAreFull(5, 5)).toBe(true);
    expect(isOverPurchasedSeats(5, 5)).toBe(false);
  });

  it('is true past the purchased count too', () => {
    expect(seatsAreFull(5, 9)).toBe(true);
  });

  it('is false while there are seats going spare', () => {
    expect(seatsAreFull(5, 4)).toBe(false);
  });

  // Nothing bought, so nothing used up — and nothing charged until a plan is.
  it('is false for an organisation that never bought seats', () => {
    expect(seatsAreFull(null, 40)).toBe(false);
  });
});
