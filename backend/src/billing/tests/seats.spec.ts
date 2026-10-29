import {
  billedSeatCount,
  isOverPurchasedSeats,
  MAX_PURCHASABLE_SEATS,
  needsOverageAcknowledgement,
  parseSeatCount,
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

describe('needsOverageAcknowledgement', () => {
  it('asks the first time the team goes over', () => {
    expect(needsOverageAcknowledgement(50, 54, null)).toBe(true);
  });

  it('stops asking once that count is acknowledged', () => {
    expect(needsOverageAcknowledgement(50, 54, 54)).toBe(false);
  });

  // Saying "understood" about 54 is not saying it about 80: the figure on
  // the next invoice is not the same figure.
  it('asks again when the team grows further', () => {
    expect(needsOverageAcknowledgement(50, 80, 54)).toBe(true);
  });

  it('does not ask again when the team shrinks but stays over', () => {
    expect(needsOverageAcknowledgement(50, 60, 80)).toBe(false);
  });

  it('never asks while the team fits the seats', () => {
    expect(needsOverageAcknowledgement(50, 50, null)).toBe(false);
    expect(needsOverageAcknowledgement(50, 10, null)).toBe(false);
  });

  // Nothing was promised, so nothing is exceeded — every trial is here.
  it('never asks where no seats were bought', () => {
    expect(needsOverageAcknowledgement(null, 500, null)).toBe(false);
  });
});
