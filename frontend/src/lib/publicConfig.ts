export type PublicConfig = {
  billingEnabled: boolean;
};

/**
 * Billing off. Guessing "on" would show a self-hoster a paywall; guessing
 * "off" only hides a Billing link on Cloud until the next request.
 */
export const DEFAULT_PUBLIC_CONFIG: PublicConfig = { billingEnabled: false };

/** Falls back rather than throwing, so no caller needs an error state for a
 * question the user never asked. */
export function parsePublicConfig(value: unknown): PublicConfig {
  if (typeof value !== "object" || value === null) {
    return DEFAULT_PUBLIC_CONFIG;
  }
  const billingEnabled = (value as { billingEnabled?: unknown }).billingEnabled;
  return {
    billingEnabled: billingEnabled === true,
  };
}
