/** How many seats an invoice was for. Free of Nest and the Stripe SDK. */

/** Only the fields the count reads; a real line carries dozens more. */
export interface SeatLine {
  amount: number;
  quantity?: number | null;
  period?: { start?: number | null } | null;
  parent?: {
    invoice_item_details?: { proration?: boolean } | null;
    subscription_item_details?: { proration?: boolean } | null;
  } | null;
}

function isProration(line: SeatLine): boolean {
  return Boolean(
    line.parent?.subscription_item_details?.proration ??
    line.parent?.invoice_item_details?.proration,
  );
}

/** Latest period start first, then the larger quantity. */
function mostRecent(lines: SeatLine[]): SeatLine | undefined {
  return [...lines].sort(
    (a, b) =>
      (b.period?.start ?? 0) - (a.period?.start ?? 0) ||
      (b.quantity ?? 0) - (a.quantity ?? 0),
  )[0];
}

/**
 * The seat count an invoice charged for, or null where its lines say nothing
 * about seats.
 *
 * A mid-period change invoices as a **pair** of prorated lines — a credit at
 * the old count, then a charge at the new one — and the credit comes first.
 * Taking the first quantity therefore reports the count just moved *off*,
 * which is what made a rise from eight seats to nine read "8 seats".
 *
 * So: a full-period line (a renewal or first payment) wins outright;
 * otherwise the *positive* proration line, most recent first where several
 * changes land on one invoice.
 */
export function invoiceSeatCount(lines: SeatLine[]): number | null {
  const withQuantity = lines.filter(
    (line) => typeof line.quantity === 'number' && line.quantity > 0,
  );

  const fullPeriod = withQuantity.filter((line) => !isProration(line));
  if (fullPeriod.length > 0) {
    return mostRecent(fullPeriod)?.quantity ?? null;
  }

  // Strictly positive: a credit names the count being left behind.
  const charged = withQuantity.filter((line) => line.amount > 0);
  return charged.length > 0 ? (mostRecent(charged)?.quantity ?? null) : null;
}
