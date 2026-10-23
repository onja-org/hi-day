import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What the desktop agent reports on its heartbeat about whether it can
 * record the app in front — so a Linux machine recording none shows as
 * such on the Devices page. All nullable: null until an agent new enough to
 * report it has beaten once. Hand-written, same reasoning as
 * `1790920000000-AddMembershipAppUrlTracking`.
 */
export class AddDeviceAppCaptureHealth1791020000000 implements MigrationInterface {
  name = 'AddDeviceAppCaptureHealth1791020000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "AppCaptureStatus" AS ENUM('ok', 'degraded', 'unavailable')`,
    );
    await queryRunner.query(
      `ALTER TABLE "devices" ADD "appCaptureStatus" "AppCaptureStatus"`,
    );
    await queryRunner.query(
      `ALTER TABLE "devices" ADD "appCaptureDetail" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "devices" ADD "displaySession" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "devices" DROP COLUMN "displaySession"`,
    );
    await queryRunner.query(
      `ALTER TABLE "devices" DROP COLUMN "appCaptureDetail"`,
    );
    await queryRunner.query(
      `ALTER TABLE "devices" DROP COLUMN "appCaptureStatus"`,
    );
    await queryRunner.query(`DROP TYPE "AppCaptureStatus"`);
  }
}
