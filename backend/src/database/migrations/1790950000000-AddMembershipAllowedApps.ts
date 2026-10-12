import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-member override of the Organisation's "Allowed apps" setting.
 * Nullable: `NULL` means inherit the org default. Hand-written, same
 * reasoning as `1790920000000-AddMembershipAppUrlTracking`.
 */
export class AddMembershipAllowedApps1790950000000 implements MigrationInterface {
  name = 'AddMembershipAllowedApps1790950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD "allowedApps" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "memberships" DROP COLUMN "allowedApps"`,
    );
  }
}
