import { MigrationInterface, QueryRunner } from 'typeorm';

/** Hand-written, same reasoning as `1790860000000-CreateSavedReports`. */
export class AddSavedReportSchedulePaused1790910000000 implements MigrationInterface {
  name = 'AddSavedReportSchedulePaused1790910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "saved_reports" ADD "schedulePaused" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "saved_reports" DROP COLUMN "schedulePaused"`,
    );
  }
}
