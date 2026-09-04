import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTimeEntries1788504732663 implements MigrationInterface {
  name = 'CreateTimeEntries1788504732663';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // An earlier, since-superseded design (AddTimeEntries1788434452158) already
    // created a `time_entries` table shaped for manual note-based logging
    // (userId/note, non-nullable endedAt). That feature never shipped past a
    // handful of dev rows, so we drop it here rather than threading a
    // backward-compatible ALTER through a shape with no real overlap (no
    // project/task attribution to migrate old rows into).
    await queryRunner.query(`DROP TABLE IF EXISTS "time_entries"`);

    await queryRunner.query(
      `CREATE TYPE "TimeEntrySource" AS ENUM('web', 'agent')`,
    );
    await queryRunner.query(`
      CREATE TABLE "time_entries" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organisationId" uuid NOT NULL,
        "membershipId" uuid NOT NULL,
        "projectId" uuid NOT NULL,
        "taskId" uuid,
        "startedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
        "endedAt" TIMESTAMP(3) WITH TIME ZONE,
        "source" "TimeEntrySource" NOT NULL,
        "deviceId" uuid,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_time_entries_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_time_entries_membershipId" ON "time_entries" ("membershipId")`,
    );
    // The invariant "at most one running timer per Membership" — structural,
    // not just enforced in TimeEntriesService — so a race between two
    // clients (e.g. web + agent) can't ever produce two open entries.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_time_entries_one_running_per_membership" ON "time_entries" ("membershipId") WHERE "endedAt" IS NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "time_entries" ADD CONSTRAINT "FK_time_entries_organisationId" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "time_entries" ADD CONSTRAINT "FK_time_entries_membershipId" FOREIGN KEY ("membershipId") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "time_entries" ADD CONSTRAINT "FK_time_entries_projectId" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "time_entries" ADD CONSTRAINT "FK_time_entries_taskId" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "time_entries" ADD CONSTRAINT "FK_time_entries_deviceId" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "time_entries"`);
    await queryRunner.query(`DROP TYPE "TimeEntrySource"`);
  }
}
