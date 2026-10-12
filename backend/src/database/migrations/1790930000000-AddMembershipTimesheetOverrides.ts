import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-member overrides for the Organisation's Timesheets settings.
 * `timesheetModifyTime`: `null` inherits `Organisation.settings.timesheetModifyTime`.
 * `timesheetRequireApproval`: `null` inherits `Organisation.settings.timesheetRequireApproval`.
 * Hand-written, same reasoning as `1790860000000-CreateSavedReports`.
 */
export class AddMembershipTimesheetOverrides1790930000000 implements MigrationInterface {
  name = 'AddMembershipTimesheetOverrides1790930000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD "timesheetModifyTime" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD "timesheetRequireApproval" boolean`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "memberships" DROP COLUMN "timesheetRequireApproval"`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" DROP COLUMN "timesheetModifyTime"`,
    );
  }
}
