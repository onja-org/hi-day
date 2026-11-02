/**
 * Hi Day Cloud's public site, which lives in its own private repo.
 *
 * The landing and pricing pages used to be routes in this app. They were
 * removed when it became open source: a self-hosted install should not
 * serve pages advertising a paid hosted version of itself.
 *
 * One absolute link remains, and only on Hi Day Cloud — see
 * `CLOUD_PRICING_URL`. A self-hosted install never renders it, because
 * every component that uses it sits behind a billing gate.
 */
export const CLOUD_SITE_URL = "https://hiday.io";

/**
 * Where to send an admin who wants to pay but cannot be shown a card field
 * here — `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is unset, so Stripe Elements
 * cannot draw one.
 *
 * On Hi Day Cloud that is a misconfiguration rather than a normal state,
 * and this is the graceful end of it. It is absolute because the pricing
 * page is no longer a route in this app.
 */
export const CLOUD_PRICING_URL = `${CLOUD_SITE_URL}/pricing`;
