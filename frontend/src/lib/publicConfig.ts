/** What the backend tells every client about this installation. */
export type PublicConfig = {
  /**
   * Whether this installation bills anybody. False on a self-hosted
   * install, which is free forever for any team size.
   */
  billingEnabled: boolean;
};

/**
 * What to assume when the backend cannot be reached.
 *
 * **Billing off.** The two mistakes are not symmetric: guessing "off" on a
 * Cloud deploy hides a Billing page until the next request succeeds, while
 * guessing "on" shows a self-hoster a trial banner and a paywall for a
 * product we told them was free forever — on an install with nothing to
 * flag it as wrong. The quiet failure is the right one.
 */
export const DEFAULT_PUBLIC_CONFIG: PublicConfig = { billingEnabled: false };

/**
 * Narrows whatever the endpoint returned to the one field we read.
 *
 * Anything unexpected — a proxy's HTML error page, an older backend that
 * has no `/config` yet — falls back rather than throwing, because every
 * caller of this would otherwise have to render an error state for a
 * question the user never asked.
 */
export function parsePublicConfig(value: unknown): PublicConfig {
  if (typeof value !== "object" || value === null) {
    return DEFAULT_PUBLIC_CONFIG;
  }
  const billingEnabled = (value as { billingEnabled?: unknown }).billingEnabled;
  return {
    billingEnabled: billingEnabled === true,
  };
}
