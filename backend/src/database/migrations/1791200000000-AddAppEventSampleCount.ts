import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets one `app_events` row stand for a run of identical window samples
 * (see common/app-event-samples.util.ts), so the agent can stop writing a
 * row every five seconds.
 *
 * Additive only. A constant default means Postgres adds the column without
 * rewriting the table, and every existing row reads as a run of one — the
 * single sample it always was — so no historical figure changes.
 *
 * `down` refuses to run once any merged run exists: dropping the column
 * then would silently turn each run back into one sample and lose the rest
 * of its time. Expand those rows first if a rollback is ever really needed.
 */
export class AddAppEventSampleCount1791200000000 implements MigrationInterface {
  name = 'AddAppEventSampleCount1791200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "app_events" ADD "sampleCount" integer NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "app_events" ADD CONSTRAINT "CHK_app_events_sampleCount_positive" CHECK ("sampleCount" >= 1)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ merged }] = (await queryRunner.query(
      `SELECT EXISTS (SELECT 1 FROM "app_events" WHERE "sampleCount" > 1) AS "merged"`,
    )) as { merged: boolean }[];
    if (merged) {
      throw new Error(
        'app_events holds merged runs (sampleCount > 1); dropping the column would lose their time. Expand them first.',
      );
    }
    await queryRunner.query(
      `ALTER TABLE "app_events" DROP CONSTRAINT "CHK_app_events_sampleCount_positive"`,
    );
    await queryRunner.query(
      `ALTER TABLE "app_events" DROP COLUMN "sampleCount"`,
    );
  }
}
