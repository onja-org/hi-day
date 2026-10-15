import { MigrationInterface, QueryRunner } from 'typeorm';

/** Per-member override of "members can delete their own screenshots";
 * `NULL` inherits the Organisation's. */
export class AddMembershipCanDeleteScreenshots1790980000000 implements MigrationInterface {
  name = 'AddMembershipCanDeleteScreenshots1790980000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD "canDeleteScreenshots" boolean`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "memberships" DROP COLUMN "canDeleteScreenshots"`,
    );
  }
}
