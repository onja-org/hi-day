import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Keystroke, mouse-click and mouse-movement counts per 10-minute activity
 * sample. Nullable and left `NULL` on every existing row: those periods
 * were never counted, which reads "not available", never 0.
 */
export class AddActivitySampleInputCounts1791150000000 implements MigrationInterface {
  name = 'AddActivitySampleInputCounts1791150000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "activity_samples" ADD "keystrokes" integer, ADD "mouseClicks" integer, ADD "mouseMovement" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "activity_samples" DROP COLUMN "mouseMovement", DROP COLUMN "mouseClicks", DROP COLUMN "keystrokes"`,
    );
  }
}
