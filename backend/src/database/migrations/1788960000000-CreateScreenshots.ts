import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hand-written, same reasoning as `1788873638519-CreateAppEvents` — this
 * dev DB's schema has drifted from what `migration:generate` expects, so a
 * generated diff isn't trusted for anything beyond a plain column diff
 * (see docs/adr/0007-...).
 */
export class CreateScreenshots1788960000000 implements MigrationInterface {
  name = 'CreateScreenshots1788960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "screenshots" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organisationId" uuid NOT NULL,
        "membershipId" uuid NOT NULL,
        "deviceId" uuid NOT NULL,
        "storageKey" character varying NOT NULL,
        "capturedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
        "keptUntil" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_screenshots_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_screenshots_membershipId_capturedAt" ON "screenshots" ("membershipId", "capturedAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_screenshots_keptUntil" ON "screenshots" ("keptUntil")`,
    );
    await queryRunner.query(`
      ALTER TABLE "screenshots" ADD CONSTRAINT "FK_screenshots_organisationId"
      FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "screenshots" ADD CONSTRAINT "FK_screenshots_membershipId"
      FOREIGN KEY ("membershipId") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "screenshots" ADD CONSTRAINT "FK_screenshots_deviceId"
      FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "screenshots"`);
  }
}
