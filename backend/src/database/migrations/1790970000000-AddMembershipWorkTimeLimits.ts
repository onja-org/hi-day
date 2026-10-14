import { MigrationInterface, QueryRunner } from 'typeorm';

/** Per-member overrides of the work time limits; each `NULL` inherits. */
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
