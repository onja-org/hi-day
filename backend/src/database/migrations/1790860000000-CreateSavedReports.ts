import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hand-written, same reasoning as `1789620000000-CreateNotes`: the dev
 * schema has drifted from the entities' default constraint names, so a
 * generated migration would also rewrite dozens of unrelated constraints.
 */
export class CreateSavedReports1790860000000 implements MigrationInterface {
  name = 'CreateSavedReports1790860000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "saved_reports" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organisationId" uuid NOT NULL,
        "membershipId" uuid NOT NULL,
        "name" character varying(120) NOT NULL,
        "reportType" character varying(40) NOT NULL DEFAULT 'time-and-activity',
        "settings" jsonb NOT NULL,
        "schedule" jsonb,
        "lastSentOn" character varying(10),
        "lastSentAt" TIMESTAMP WITH TIME ZONE,
        "lastError" text,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_saved_reports_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_saved_reports_organisationId_membershipId" ON "saved_reports" ("organisationId", "membershipId")`,
    );
    // The scheduler scans only the (few) rows that have a schedule.
    await queryRunner.query(
      `CREATE INDEX "IDX_saved_reports_scheduled" ON "saved_reports" ("id") WHERE "schedule" IS NOT NULL`,
    );
    await queryRunner.query(`
      ALTER TABLE "saved_reports" ADD CONSTRAINT "FK_saved_reports_organisationId"
      FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "saved_reports" ADD CONSTRAINT "FK_saved_reports_membershipId"
      FOREIGN KEY ("membershipId") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "saved_reports"`);
  }
}
