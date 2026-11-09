/**
 * Where one person's favourites in one organisation live in localStorage.
 * Keyed by user as well as organisation, so two members sharing a browser
 * don't share stars. Favourites saved before this under the
 * organisation-only key belong to no one in particular and are left unread.
 */
export function favouriteReportsStorageKey(
  organisationId: number,
  userId: string,
): string {
  return `favourite-reports:${organisationId}:user:${userId}`;
}

/** Reads the stored favourites, ignoring anything that isn't a JSON array of strings. */
export function parseFavouriteReportIds(raw: string | null): string[] {
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

/** Removes `id` if it's already a favourite, otherwise appends it. */
export function toggleFavouriteReportId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id];
}
