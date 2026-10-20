import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-member override of the Organisation's "Track time against Projects"
 * setting. Nullable: `NULL` means inherit the org default. Hand-written, same
 * reasoning as `1790920000000-AddMembershipAppUrlTracking`.
 */
export class AddMembershipProjectsEnabled1791000000000 implements MigrationInterface {
  name = 'AddMembershipProjectsEnabled1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD "projectsEnabled" boolean`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "memberships" DROP COLUMN "projectsEnabled"`,
    );
  }
}
