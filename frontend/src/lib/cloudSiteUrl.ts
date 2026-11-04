export const CLOUD_SITE_URL = "https://hiday.io";

/**
 * Absolute because the pricing page lives in its own repo now. Only reached
 * on Cloud, where `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is unset and the
 * payment modal cannot draw a card field.
 */
export const CLOUD_PRICING_URL = `${CLOUD_SITE_URL}/pricing`;

/**
 * The public website this installation belongs to, if any. The logo on the
 * signed-out pages links there.
 *
 * Unset by default, and then the logo is not a link at all — a self-hosted
 * install has no marketing site, and pointing its login page at hiday.io
 * would advertise the paid version to somebody already running the free one.
 */
export const WEBSITE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL?.trim() || null;
