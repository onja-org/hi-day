import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-member override of the Organisation's "Track apps & URLs" setting.
 * Nullable: `NULL` means inherit the org default. Hand-written, same
 * reasoning as `1790860000000-CreateSavedReports`.
 */
export class AddMembershipAppUrlTracking1790920000000 implements MigrationInterface {
  name = 'AddMembershipAppUrlTracking1790920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD "appUrlTracking" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "memberships" DROP COLUMN "appUrlTracking"`,
    );
  }
}
