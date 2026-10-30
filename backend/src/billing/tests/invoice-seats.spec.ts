import { invoiceSeatCount } from '../invoice-seats';
import type { SeatLine } from '../invoice-seats';

const OCT_29 = 1793318400;
const OCT_30 = 1793404800;

function prorated(amount: number, quantity: number, start: number): SeatLine {
  return {
    amount,
    quantity,
    period: { start },
    parent: { subscription_item_details: { proration: true } },
  };
}

function fullPeriod(amount: number, quantity: number, start: number): SeatLine {
  return {
    amount,
    quantity,
    period: { start },
    parent: { subscription_item_details: { proration: false } },
  };
}

describe('invoiceSeatCount', () => {
  // The four invoices that exposed this, with the counts they used to show.
  it('counts the seats charged for, not the seats credited back', () => {
    // 8 seats to 9: used to read "8 seats".
    expect(
      invoiceSeatCount([
        prorated(-33522, 8, OCT_30),
        prorated(37712, 9, OCT_30),
      ]),
    ).toBe(9);
  });

  it('reads a renewal or first payment straight off its own line', () => {
    expect(invoiceSeatCount([fullPeriod(4200, 1, OCT_29)])).toBe(1);
  });

  // The $167.62 invoice: three proration pairs from changes on two days.
  // It used to read "1 seat"; the change actually paid for took it to five.
  it('takes the most recent change where several land on one invoice', () => {
    expect(
      invoiceSeatCount([
        prorated(-4190, 1, OCT_30),
        prorated(20952, 5, OCT_30),
        prorated(-399, 1, OCT_29),
        prorated(4199, 1, OCT_29),
        prorated(-4199, 1, OCT_29),
        prorated(399, 1, OCT_29),
      ]),
    ).toBe(5);
  });

  // A renewal invoice can carry leftover prorations; the renewal is the count.
  it('prefers the full-period line over any proration beside it', () => {
    expect(
      invoiceSeatCount([
        prorated(-1000, 3, OCT_29),
        prorated(2000, 12, OCT_29),
        fullPeriod(37800, 9, OCT_30),
      ]),
    ).toBe(9);
  });

  // Giving up seats still charges for the remainder at the new, lower count.
  it('reports the lower count when seats are given up', () => {
    expect(
      invoiceSeatCount([
        prorated(-20952, 5, OCT_30),
        prorated(8380, 2, OCT_30),
      ]),
    ).toBe(2);
  });

  it('says nothing where the lines carry no seat count', () => {
    expect(invoiceSeatCount([])).toBeNull();
    expect(invoiceSeatCount([{ amount: 500 }])).toBeNull();
    expect(invoiceSeatCount([{ amount: 500, quantity: 0 }])).toBeNull();
    // A credit on its own names only what was left behind, so it is no answer.
    expect(invoiceSeatCount([prorated(-4190, 8, OCT_30)])).toBeNull();
  });
});
