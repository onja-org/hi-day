import { MigrationInterface, QueryRunner } from 'typeorm';

/** Removes the `activity_samples` table — the activity-level tracking feature was removed. */
export class DropActivitySamples1790100000000 implements MigrationInterface {
  name = 'DropActivitySamples1790100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "activity_samples"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "activity_samples" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organisationId" uuid NOT NULL,
        "membershipId" uuid NOT NULL,
        "deviceId" uuid NOT NULL,
        "activePercentage" smallint NOT NULL,
        "periodStart" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
        "periodEnd" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_activity_samples_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_activity_samples_membershipId_periodStart" ON "activity_samples" ("membershipId", "periodStart")`,
    );
    await queryRunner.query(`
      ALTER TABLE "activity_samples" ADD CONSTRAINT "FK_activity_samples_organisationId"
      FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "activity_samples" ADD CONSTRAINT "FK_activity_samples_membershipId"
      FOREIGN KEY ("membershipId") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "activity_samples" ADD CONSTRAINT "FK_activity_samples_deviceId"
      FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    `);
  }
}
