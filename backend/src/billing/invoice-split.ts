/**
 * Splitting an invoice preview into the part charged once and the part that
 * recurs. Kept free of Nest and the Stripe SDK so the arithmetic is readable
 * and testable on its own.
 */

/** Only the fields the split reads; a real line carries dozens more. */
export interface PreviewLine {
  amount: number;
  parent?: {
    invoice_item_details?: { proration?: boolean } | null;
    subscription_item_details?: { proration?: boolean } | null;
  } | null;
}

/**
 * Checked under **both** parents: Stripe reports the flag under
 * `subscription_item_details` for a line the subscription generated and
 * under `invoice_item_details` for a standalone proration item. Reading one
 * silently counts half the prorations as recurring.
 */
export function isProration(line: PreviewLine): boolean {
  return Boolean(
    line.parent?.subscription_item_details?.proration ??
    line.parent?.invoice_item_details?.proration,
  );
}

/**
 * What a change costs once: the credit for time already paid at the old
 * quantity, plus the charge for the rest of the period at the new one.
 * Negative when seats are given up.
 */
export function prorationTotal(lines: PreviewLine[]): number {
  return lines
    .filter(isProration)
    .reduce((total, line) => total + line.amount, 0);
}

/**
 * What every period from now costs, one-off adjustments taken out.
 *
 * Neither figure can be read off `amount_due`: Stripe's preview adds the
 * prorations and the renewal together, so subtracting one preview's total
 * from another's double-counts the rise. See ADR 0033.
 */
export function recurringTotal(lines: PreviewLine[]): number {
  return lines
    .filter((line) => !isProration(line))
    .reduce((total, line) => total + line.amount, 0);
}
