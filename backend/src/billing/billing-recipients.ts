/**
 * Who hears about billing. Kept free of Nest and TypeORM so the fallback
 * rule is readable and testable on its own.
 */

/**
 * The owner always, plus the billing address when one is set and differs.
 *
 * Never the billing address alone: it is typed by hand into Settings and
 * never verified, so a transposed character would silently swallow the one
 * message that says access is ending. The owner's address is the one we
 * know reaches somebody — it is how they signed in.
 *
 * Returns empty when there is no owner to email and no billing address:
 * an Organisation whose owner's User row has been erased and that never
 * set one has nobody, which the caller treats as nothing-to-send rather
 * than an error.
 */
export function billingRecipients(
  billingEmail: string | null,
  ownerEmail: string | null,
): string[] {
  const recipients = [ownerEmail, billingEmail]
    .filter((address): address is string => Boolean(address?.trim()))
    .map((address) => address.trim());

  // Case-insensitively, since the same mailbox typed two ways is one
  // person, and sending twice reads as a bug.
  const seen = new Set<string>();
  return recipients.filter((address) => {
    const key = address.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Who an **invoice** goes to: the billing address when one is set, the
 * owner otherwise. One address, not both.
 *
 * Deliberately different from `billingRecipients` above, and the difference
 * is the point. A warning that access is ending is worth sending twice —
 * the billing address is unverified, and a typo must not swallow it. A
 * receipt is not: accounts payable asked for it, nobody is harmed if the
 * founder does not also get a copy, and a duplicate receipt in two inboxes
 * is how a bill gets paid twice.
 *
 * Null when there is nobody to send to, which the caller treats as nothing
 * to do rather than an error.
 */
export function invoiceRecipient(
  billingEmail: string | null,
  ownerEmail: string | null,
): string | null {
  const chosen = billingEmail?.trim() || ownerEmail?.trim();
  return chosen ? chosen : null;
}
