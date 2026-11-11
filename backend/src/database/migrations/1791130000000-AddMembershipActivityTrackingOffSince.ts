import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * When "Record activity" last went from on to off for a member, whichever
 * switch did it. Samples begun before then were measured while it was on
 * and are still accepted when they arrive later — the agent's part-period
 * at the switch, an offline queue; anything begun after is dropped. `NULL`
 * (every member until this is first written) keeps the old rule: off drops
 * everything.
 */
export class AddMembershipActivityTrackingOffSince1791130000000 implements MigrationInterface {
  name = 'AddMembershipActivityTrackingOffSince1791130000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD "activityTrackingOffSince" TIMESTAMP(3) WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "memberships" DROP COLUMN "activityTrackingOffSince"`,
    );
  }
}
