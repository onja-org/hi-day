export enum RollupPeriodType {
  DAY = 'day',
  /**
   * Reserved, not yet populated by any job — the day-boundary-split cron
   * guarantees a `TimeEntry` never spans midnight, which is what makes
   * `DAY` bucketing safe by construction. No equivalent guarantee exists
   * at hour boundaries yet, so computing `HOUR` rows needs window-clipping
   * logic this codebase doesn't have. Kept in the enum so adding hourly
   * rollups later is a job change, not a schema migration.
   */
  HOUR = 'hour',
}
