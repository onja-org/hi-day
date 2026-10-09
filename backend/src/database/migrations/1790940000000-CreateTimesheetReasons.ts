import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The Organisation-owned Reasons list offered when adding, editing or
 * deleting time, plus the `timesheetRequireReason` setting that decides
 * whether picking one is compulsory.
 *
 * Nothing references these rows — the chosen label is copied onto the audit
 * row (ADR-0024) — so a Reason can be deleted outright without orphaning
 * recorded history, and the FK cascades with its Organisation.
 *
 * Hand-written, same reasoning as `1790860000000-CreateSavedReports`.
 */
export class CreateTimesheetReasons1790940000000 implements MigrationInterface {
  name = 'CreateTimesheetReasons1790940000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "timesheet_reasons" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organisationId" uuid NOT NULL,
        "label" character varying(100) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_timesheet_reasons_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_timesheet_reasons_organisationId" ON "timesheet_reasons" ("organisationId")`,
    );
    // Case-insensitive: "Client meeting" and "client meeting" would read as
    // duplicates in the picker, so the database refuses the second.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_timesheet_reasons_organisationId_label" ON "timesheet_reasons" ("organisationId", LOWER("label"))`,
    );
    await queryRunner.query(`
      ALTER TABLE "timesheet_reasons"
      ADD CONSTRAINT "FK_timesheet_reasons_organisationId"
      FOREIGN KEY ("organisationId") REFERENCES "organisations"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
    `);

    // Every Organisation that predates this migration gets the same three
    // defaults a newly-created one is seeded with, so no admin opens the
    // Reasons section to an empty list they did not choose.
    await queryRunner.query(`
      INSERT INTO "timesheet_reasons" ("organisationId", "label")
      SELECT "id", seed."label"
      FROM "organisations"
      CROSS JOIN (
        VALUES ('Forgot to start timer'), ('Forgot to stop timer'), ('Client meeting')
      ) AS seed("label")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "timesheet_reasons"`);
  }
}
