import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-member overrides of the Organisation's work time limits. Every
 * column is nullable and inherits when null, independently of the others:
 * a member may override only their daily limit and take the rest from the
 * Organisation.
 */
export class AddMembershipWorkTimeLimits1790970000000 implements MigrationInterface {
  name = 'AddMembershipWorkTimeLimits1790970000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD "expectedWorkDays" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD "trackingDisabledDays" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD "expectedWeeklyHours" numeric(5,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD "weeklyLimitHours" numeric(5,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD "dailyLimitHours" numeric(5,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of [
      'dailyLimitHours',
      'weeklyLimitHours',
      'expectedWeeklyHours',
      'trackingDisabledDays',
      'expectedWorkDays',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "memberships" DROP COLUMN "${column}"`,
      );
    }
  }
}
