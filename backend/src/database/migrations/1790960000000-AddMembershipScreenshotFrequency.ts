import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-member override of the Organisation's screenshot frequency.
 * `NULL` inherits; `0` is the "None" option, meaning no screenshots for
 * this member whatever the organisation default says.
 */
export class AddMembershipScreenshotFrequency1790960000000 implements MigrationInterface {
  name = 'AddMembershipScreenshotFrequency1790960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD "screenshotFrequencySeconds" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "memberships" DROP COLUMN "screenshotFrequencySeconds"`,
    );
  }
}
