/**
 * Leaves the page with a full page load after logging in or out, never a
 * client-side `router.push`. Everything the app holds in memory belongs to
 * whoever was signed in: the React Query cache in particular is keyed by
 * what is fetched ("my profile", "current organisation"), not by who
 * fetched it, so a client-side transition would show the previous user's
 * data to the next one. A full load starts every page from an empty cache.
 */
export function navigateAfterSessionChange(path: string): void {
  window.location.assign(path);
}
