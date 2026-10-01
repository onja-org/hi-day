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
