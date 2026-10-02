/** The 1-based `page` of `items` at `perPage` per page. */
export function paginateRows<T>(items: T[], page: number, perPage: number): T[] {
  return items.slice((page - 1) * perPage, page * perPage);
}
