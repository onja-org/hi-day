import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What an agent needs to hand its offline work back without losing or
 * duplicating any of it.
 *
 * `startOperationId`/`stopOperationId` are the agent's own ids for the
 * operations it replays, so a resend after a dropped response is
 * recognised instead of writing the hours twice. The unique indexes are
 * the real guarantee — the service looks for an existing row first, but
 * two replays racing each other both pass that check, and only the
 * database can settle it. Partial (`WHERE ... IS NOT NULL`) because every
 * pre-existing row and every web timer has no id and they must not
 * collide with each other. Hand-written for the same reason ADR-0022's
 * index was: `migration:generate` does not reliably round-trip a partial
 * index's `WHERE` clause.
 *
 * `closedAsAbandoned` marks an entry the sweeper gave up on rather than
 * one a person stopped. Without the distinction a reconnecting agent
 * could not correct the sweeper's guess at when it stopped without also
 * being able to reopen a real stop.
 */
export class AddTimeEntryOfflineReconciliation1791010000000 implements MigrationInterface {
  name = 'AddTimeEntryOfflineReconciliation1791010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "time_entries" ADD "startOperationId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "time_entries" ADD "stopOperationId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "time_entries" ADD "closedAsAbandoned" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_time_entries_startOperationId" ON "time_entries" ("startOperationId") WHERE "startOperationId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_time_entries_stopOperationId" ON "time_entries" ("stopOperationId") WHERE "stopOperationId" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_time_entries_stopOperationId"`);
    await queryRunner.query(`DROP INDEX "UQ_time_entries_startOperationId"`);
    await queryRunner.query(
      `ALTER TABLE "time_entries" DROP COLUMN "closedAsAbandoned"`,
    );
    await queryRunner.query(
      `ALTER TABLE "time_entries" DROP COLUMN "stopOperationId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "time_entries" DROP COLUMN "startOperationId"`,
    );
  }
}
