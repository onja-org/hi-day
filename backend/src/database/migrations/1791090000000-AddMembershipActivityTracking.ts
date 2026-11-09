import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-member override of the Organisation's "Record activity" setting.
 * Nullable: `NULL` means inherit the org default. No backfill — the org
 * default itself resolves to `true` when unset, so every existing
 * organisation stays on without touching a row (see
 * `DEFAULT_CAPTURE_SETTINGS`).
 */
export class AddMembershipActivityTracking1791090000000 implements MigrationInterface {
  name = 'AddMembershipActivityTracking1791090000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD "activityTrackingEnabled" boolean`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "memberships" DROP COLUMN "activityTrackingEnabled"`,
    );
  }
}
