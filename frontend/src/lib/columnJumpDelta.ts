type HorizontalRect = { left: number; width: number };

/**
 * How far to move a dragged card sideways so it lands centred in the next
 * column over (`direction` 1 = right, -1 = left) — lets arrow keys jump a
 * whole Kanban column instead of nudging a few pixels at a time. The card's
 * current column is whichever one contains its centre (or the nearest).
 * Returns null when there's no column in that direction.
 */
export function columnJumpDelta(
  card: HorizontalRect,
  columns: HorizontalRect[],
  direction: 1 | -1,
): number | null {
  if (columns.length === 0) return null;
  const sorted = [...columns].sort((a, b) => a.left - b.left);
  const centre = card.left + card.width / 2;
  const distance = (column: HorizontalRect) =>
    Math.abs(column.left + column.width / 2 - centre);
  const containing = sorted.findIndex(
    (column) => centre >= column.left && centre <= column.left + column.width,
  );
  const current =
    containing !== -1
      ? containing
      : sorted.indexOf(sorted.reduce((best, column) => (distance(column) < distance(best) ? column : best)));
  const target = sorted[current + direction];
  if (!target) return null;
  return target.left + (target.width - card.width) / 2 - card.left;
}
