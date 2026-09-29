/** Whether any of `fields` contains `search` (case-insensitive); a blank
 * search matches everything and null fields are skipped. */
export function matchesSearch(fields: (string | null)[], search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return fields.some((field) => field?.toLowerCase().includes(needle));
}
