import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrganisationIdToDeviceSessions1788504732662 implements MigrationInterface {
  name = 'AddOrganisationIdToDeviceSessions1788504732662';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "device_sessions" ADD "organisationId" uuid`,
    );
    // Backfill from the owning Device's current organisationId — the best
    // available approximation for pre-existing sessions, which predate this
    // column existing at all.
    await queryRunner.query(`
      UPDATE "device_sessions" ds
      SET "organisationId" = d."organisationId"
      FROM "devices" d
      WHERE d.id = ds."deviceId"
    `);
    await queryRunner.query(
      `ALTER TABLE "device_sessions" ALTER COLUMN "organisationId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_sessions" ADD CONSTRAINT "FK_device_sessions_organisationId" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "device_sessions" DROP CONSTRAINT "FK_device_sessions_organisationId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_sessions" DROP COLUMN "organisationId"`,
    );
  }
}
