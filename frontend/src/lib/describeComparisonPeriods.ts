/** "the previous 3 weeks", "the previous 3 days", or "the previous 3 periods of 10 days". */
export function describeComparisonPeriods(periodDays: number, periods: number): string {
  if (periodDays === 7) return `the previous ${periods} weeks`;
  if (periodDays === 1) return `the previous ${periods} days`;
  return `the previous ${periods} periods of ${periodDays} days`;
}
