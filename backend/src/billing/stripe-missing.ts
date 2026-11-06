/**
 * Whether a Stripe error means the object asked for does not exist —
 * deleted in the dashboard, or a test-mode object wiped. Read off the
 * error's `code` rather than its class, so callers stay testable with a
 * plain object.
 */
export function isStripeMissing(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'resource_missing';
}
