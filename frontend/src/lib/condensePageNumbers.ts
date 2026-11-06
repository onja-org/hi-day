/**
 * The page buttons to show for a long list: the first and last page, the
 * current page and its neighbours, with "gap" where pages are skipped.
 * A gap is only used when it hides at least two pages.
 */
export function condensePageNumbers(page: number, pageCount: number): (number | "gap")[] {
  const shown = [...new Set([1, page - 1, page, page + 1, pageCount])]
    .filter((number) => number >= 1 && number <= pageCount)
    .sort((a, b) => a - b);

  return shown.flatMap((number, index) => {
    const previous = shown[index - 1];
    if (previous === undefined || number - previous === 1) return [number];
    if (number - previous === 2) return [previous + 1, number];
    return ["gap" as const, number];
  });
}
