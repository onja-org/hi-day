/** "9–16 of 40": which items a 1-based page holds, for the pager. */
export function describePageRange(
  page: number,
  pageSize: number,
  total: number,
): string {
  if (total === 0) return "0 of 0";
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return `${first}–${last} of ${total}`;
}
