import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hand-written rather than `migration:generate`d — this dev DB's actual
 * schema has drifted from what a full diff expects (pre-existing, not
 * caused by this change; a generate attempt churned unrelated FK/index
 * names on `time_entries`/`team_memberships`/`device_sessions` without
 * touching `app_events` at all). Same reasoning as
 * docs/adr/0007-...: "migration:generate isn't trusted for anything beyond
 * a plain column diff."
 */
export class CreateAppEvents1788873638519 implements MigrationInterface {
  name = 'CreateAppEvents1788873638519';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "AppEventTitleUnavailableReason" AS ENUM('permission-denied', 'not-exposed', 'hidden-by-app')`,
    );
    await queryRunner.query(`
      CREATE TABLE "app_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organisationId" uuid NOT NULL,
        "membershipId" uuid NOT NULL,
        "deviceId" uuid NOT NULL,
        "appName" character varying NOT NULL,
        "title" text,
        "titleUnavailableReason" "AppEventTitleUnavailableReason",
        "sampledAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_app_events_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_app_events_membershipId_sampledAt" ON "app_events" ("membershipId", "sampledAt")`,
    );
    await queryRunner.query(`
      ALTER TABLE "app_events" ADD CONSTRAINT "FK_app_events_organisationId"
      FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "app_events" ADD CONSTRAINT "FK_app_events_membershipId"
      FOREIGN KEY ("membershipId") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "app_events" ADD CONSTRAINT "FK_app_events_deviceId"
      FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "app_events"`);
    await queryRunner.query(`DROP TYPE "AppEventTitleUnavailableReason"`);
  }
}
