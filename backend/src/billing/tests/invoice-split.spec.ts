import {
  isProration,
  prorationTotal,
  recurringTotal,
} from '../invoice-split';
import type { PreviewLine } from '../invoice-split';

/** The real shape of a preview after raising 5 annual seats to 6, mid-period. */
const SEAT_RISE: PreviewLine[] = [
  {
    amount: -20952,
    parent: { subscription_item_details: { proration: true } },
  },
  {
    amount: 25142,
    parent: { subscription_item_details: { proration: true } },
  },
  {
    amount: 25200,
    parent: { subscription_item_details: { proration: false } },
  },
];

describe('splitting a preview', () => {
  // $251.42 charged for the rest of the year, less $209.52 credited for the
  // time already paid for at five seats: one extra seat, not two.
  it('charges once only for the part-period difference', () => {
    expect(prorationTotal(SEAT_RISE)).toBe(4190);
  });

  it('reports the renewal without the one-off adjustment in it', () => {
    expect(recurringTotal(SEAT_RISE)).toBe(25200);
  });

  // The bug this replaces: amount_due is the two added together, so the
  // difference between two previews double-counts the rise.
  it('does not equal the difference between the two previews', () => {
    const proposedAmountDue = SEAT_RISE.reduce((t, l) => t + l.amount, 0);
    const currentAmountDue = 21000;
    expect(proposedAmountDue - currentAmountDue).toBe(8390);
    expect(prorationTotal(SEAT_RISE)).not.toBe(8390);
  });

  it('reads the flag off an invoice item parent as well', () => {
    const line: PreviewLine = {
      amount: 500,
      parent: { invoice_item_details: { proration: true } },
    };
    expect(isProration(line)).toBe(true);
    expect(prorationTotal([line])).toBe(500);
    expect(recurringTotal([line])).toBe(0);
  });

  it('treats a line with no parent at all as recurring', () => {
    expect(isProration({ amount: 100 })).toBe(false);
    expect(isProration({ amount: 100, parent: null })).toBe(false);
  });

  // Giving up seats mid-period earns a credit, which is not a charge.
  it('returns a negative total when seats are given up', () => {
    expect(
      prorationTotal([
        { amount: -8000, parent: { subscription_item_details: { proration: true } } },
        { amount: 4000, parent: { subscription_item_details: { proration: true } } },
      ]),
    ).toBe(-4000);
  });

  it('is zero either way for an empty preview', () => {
    expect(prorationTotal([])).toBe(0);
    expect(recurringTotal([])).toBe(0);
  });
});
