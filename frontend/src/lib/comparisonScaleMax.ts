/**
 * The value a comparison bar's full width stands for: the largest of the
 * figures shown, so the biggest bar fills the track and the rest read
 * against it. Never below `floor`, so a row of zeros draws empty bars
 * rather than dividing by zero.
 */
export function comparisonScaleMax(values: (number | null)[], floor = 1): number {
  return Math.max(floor, ...values.filter((value): value is number => value !== null));
}
