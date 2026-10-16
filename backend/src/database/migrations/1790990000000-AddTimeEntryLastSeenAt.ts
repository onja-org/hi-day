import { MigrationInterface, QueryRunner } from 'typeorm';

/** Heartbeat for a web timer, which has no Device to carry one. */
export class AddTimeEntryLastSeenAt1790990000000 implements MigrationInterface {
  name = 'AddTimeEntryLastSeenAt1790990000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "time_entries" ADD "lastSeenAt" TIMESTAMP(3) WITH TIME ZONE`,
    );
    // Web timers already running have never been stamped. Start their grace
    // period now, rather than leaving them unclosable (no stamp) or closing
    // them at once on an absent one.
    await queryRunner.query(
      `UPDATE "time_entries" SET "lastSeenAt" = now() WHERE "endedAt" IS NULL AND "deviceId" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "time_entries" DROP COLUMN "lastSeenAt"`,
    );
  }
}
