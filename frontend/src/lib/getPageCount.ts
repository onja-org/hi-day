/** How many pages `total` items fill — never fewer than one, so an empty
 * list still reads "page 1 of 1" rather than "page 1 of 0". */
export function getPageCount(total: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}
