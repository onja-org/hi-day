export const CLOUD_SITE_URL = "https://hiday.io";

/**
 * Absolute because the pricing page lives in its own repo now. Only reached
 * on Cloud, where `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is unset and the
 * payment modal cannot draw a card field.
 */
export const CLOUD_PRICING_URL = `${CLOUD_SITE_URL}/pricing`;
