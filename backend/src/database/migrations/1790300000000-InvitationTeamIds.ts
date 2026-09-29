import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * An invitation can now carry several teams (invite links assign more than
 * one), so the single nullable `teamId` becomes a `teamIds` uuid array,
 * like `projectIds`. The array has no foreign key, so ids of teams deleted
 * in the meantime are filtered out when the invite is shown or accepted.
 */
export class InvitationTeamIds1790300000000 implements MigrationInterface {
  name = 'InvitationTeamIds1790300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invitations" ADD "teamIds" uuid array NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `UPDATE "invitations" SET "teamIds" = ARRAY["teamId"] WHERE "teamId" IS NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "invitations" DROP COLUMN "teamId"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "invitations" ADD "teamId" uuid`);
    // Only the first team survives a rollback — the old column held one.
    await queryRunner.query(
      `UPDATE "invitations" SET "teamId" = "teamIds"[1] WHERE cardinality("teamIds") > 0 AND EXISTS (SELECT 1 FROM "teams" WHERE "teams"."id" = "teamIds"[1])`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitations" ADD CONSTRAINT "FK_113cb1411bac0e764b922699d4b" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    );
    await queryRunner.query(`ALTER TABLE "invitations" DROP COLUMN "teamIds"`);
  }
}
