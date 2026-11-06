export type PageListItem = number | "gap";

/** Up to this many pages, every page gets its own button. */
const MAX_SLOTS = 7;

/**
 * Which page buttons a pager shows: always the first and last page and
 * the pages either side of the current one, with a gap where pages are
 * skipped — at most seven slots, so the pager keeps one width while
 * paging. A gap never stands in for a single page; that page is shown.
 */
export function buildPageList(page: number, pageCount: number): PageListItem[] {
  if (pageCount <= MAX_SLOTS) {
    return Array.from({ length: Math.max(pageCount, 1) }, (_, index) => index + 1);
  }

  const current = Math.min(Math.max(page, 1), pageCount);
  let start: number;
  let end: number;
  if (current <= 4) {
    start = 2;
    end = 5;
  } else if (current >= pageCount - 3) {
    start = pageCount - 4;
    end = pageCount - 1;
  } else {
    start = current - 1;
    end = current + 1;
  }

  const middle = Array.from({ length: end - start + 1 }, (_, index) => start + index);
  return [
    1,
    ...(start > 2 ? (["gap"] as const) : []),
    ...middle,
    ...(end < pageCount - 1 ? (["gap"] as const) : []),
    pageCount,
  ];
}
