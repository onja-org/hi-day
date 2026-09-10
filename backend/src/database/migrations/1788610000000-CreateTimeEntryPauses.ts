import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTimeEntryPauses1788610000000 implements MigrationInterface {
  name = 'CreateTimeEntryPauses1788610000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "time_entry_pauses" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organisationId" uuid NOT NULL,
        "timeEntryId" uuid NOT NULL,
        "pausedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
        "resumedAt" TIMESTAMP(3) WITH TIME ZONE,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_time_entry_pauses_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_time_entry_pauses_timeEntryId" ON "time_entry_pauses" ("timeEntryId")`,
    );
    // "At most one open pause span per Time entry" — structural, same
    // reasoning as time_entries' own single-running-timer index: pause()
    // and a concurrent second pause() call can't both succeed.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_time_entry_pauses_one_open_per_entry" ON "time_entry_pauses" ("timeEntryId") WHERE "resumedAt" IS NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "time_entry_pauses" ADD CONSTRAINT "FK_time_entry_pauses_organisationId" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "time_entry_pauses" ADD CONSTRAINT "FK_time_entry_pauses_timeEntryId" FOREIGN KEY ("timeEntryId") REFERENCES "time_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "time_entry_pauses"`);
  }
}
