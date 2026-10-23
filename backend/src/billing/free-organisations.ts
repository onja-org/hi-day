/**
 * Organisations that never pay — Onja's own workspace today, and any
 * internal or test account later.
 *
 * Kept in configuration rather than the database so that changing who is
 * free is a config change: no migration, no code change, and no command run
 * against production. It is also the failsafe — if Stripe is ever down or
 * misconfigured, this still answers, so we cannot be locked out of our own
 * product by a billing problem.
 *
 * Holds `publicId`s (the 6-digit number in URLs) rather than UUIDs: readable
 * when adding one by hand, and a typo misses rather than quietly matching a
 * different organisation.
 */
export function parseFreeOrganisationIds(
  value: string | undefined,
): Set<number> {
  if (!value) return new Set();

  return new Set(
    value
      .split(',')
      .map((entry) => Number(entry.trim()))
      // A malformed entry is dropped rather than throwing: a typo in config
      // must not stop the app booting, and the organisation it was meant to
      // free simply isn't — which is visible, unlike a crash loop.
      .filter((id) => Number.isInteger(id) && id > 0),
  );
}
