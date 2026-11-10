import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * How much of an entry's span is idle time the person chose to keep. Set
 * only when the agent reports it on an idle Keep; `NULL` everywhere else —
 * "no idle stretch was folded into this entry", which is a different
 * statement from zero seconds of it, and what every entry predating this
 * reads as.
 */
export class AddTimeEntryIdleSeconds1791110000000 implements MigrationInterface {
  name = 'AddTimeEntryIdleSeconds1791110000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "time_entries" ADD "idleSeconds" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "time_entries" DROP COLUMN "idleSeconds"`,
    );
  }
}
