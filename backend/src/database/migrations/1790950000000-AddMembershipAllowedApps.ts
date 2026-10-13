import { MigrationInterface, QueryRunner } from 'typeorm';

/** Per-member override of "Allowed apps"; `NULL` inherits the org default. */
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
