/**
 * How reliable a UrlSession's captured url is — "exact" (Apple Events/UIA,
 * a real URL from the browser), "displayed" (AX/AT-SPI, a rendered string
 * read from the address bar, not guaranteed byte-for-byte), or "guess"
 * (title-only fallback, no address-bar access at all).
 */
export enum UrlSessionConfidence {
  EXACT = 'exact',
  DISPLAYED = 'displayed',
  GUESS = 'guess',
}
