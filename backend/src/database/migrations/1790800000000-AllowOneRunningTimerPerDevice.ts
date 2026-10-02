import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replaces ADR-0006's one-running-timer-per-Membership index with one
 * timer per (Membership, Device).
 *
 * `NULLS NOT DISTINCT` is the part that matters: Postgres treats NULLs as
 * distinct by default, so without it the web — which has no Device and
 * writes `deviceId IS NULL` — could open unlimited parallel entries, which
 * is exactly the second web timer the design excludes. Requires Postgres 15
 * or later.
 *
 * Hand-written rather than generated: `migration:generate` does not reliably
 * round-trip a partial index's `WHERE` clause (same caveat as the migration
 * that created the original index).
 *
 * See docs/adr/0022 for why parallel timers do not inflate reported hours.
 */
export class AllowOneRunningTimerPerDevice1790800000000 implements MigrationInterface {
  name = 'AllowOneRunningTimerPerDevice1790800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "UQ_time_entries_one_running_per_membership"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_time_entries_one_running_per_device" ON "time_entries" ("membershipId", "deviceId") NULLS NOT DISTINCT WHERE "endedAt" IS NULL`,
    );
  }

  /**
   * Reverting can fail, and should: a person may legitimately have two
   * timers open once this has run, and the old index cannot represent that.
   * Stop the extra timers before rolling back rather than having the
   * migration silently pick one to close.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "UQ_time_entries_one_running_per_device"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_time_entries_one_running_per_membership" ON "time_entries" ("membershipId") WHERE "endedAt" IS NULL`,
    );
  }
}
