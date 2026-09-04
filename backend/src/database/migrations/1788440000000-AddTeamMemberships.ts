import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTeamMemberships1788440000000 implements MigrationInterface {
  name = 'AddTeamMemberships1788440000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "team_memberships" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "membershipId" uuid NOT NULL, "teamId" uuid NOT NULL, "isManager" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(), CONSTRAINT "PK_team_memberships" PRIMARY KEY ("id"), CONSTRAINT "UQ_team_memberships_membership_team" UNIQUE ("membershipId", "teamId"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_memberships" ADD CONSTRAINT "FK_team_memberships_membershipId" FOREIGN KEY ("membershipId") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_memberships" ADD CONSTRAINT "FK_team_memberships_teamId" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );

    // Backfill: one team_memberships row per membership that currently has a
    // teamId, carrying its manager-ness over from the interim single-team
    // model (see docs/adr/0008).
    await queryRunner.query(
      `INSERT INTO "team_memberships" ("id", "membershipId", "teamId", "isManager") SELECT uuid_generate_v4(), "id", "teamId", ("role" = 'manager') FROM "memberships" WHERE "teamId" IS NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "memberships" DROP CONSTRAINT "FK_f348d359485ec8cf7737253f3d5"`,
    );
    await queryRunner.query(`ALTER TABLE "memberships" DROP COLUMN "teamId"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "memberships" ADD "teamId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD CONSTRAINT "FK_f348d359485ec8cf7737253f3d5" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    );

    // Lossy: a membership that ended up on more than one team after `up`
    // collapses back to a single team here, preferring a team it manages —
    // an accepted limitation of reverting this migration, not a blocker.
    await queryRunner.query(
      `UPDATE "memberships" m SET "teamId" = tm."teamId" FROM (SELECT DISTINCT ON ("membershipId") "membershipId", "teamId" FROM "team_memberships" ORDER BY "membershipId", "isManager" DESC) tm WHERE tm."membershipId" = m."id"`,
    );

    await queryRunner.query(
      `ALTER TABLE "team_memberships" DROP CONSTRAINT "FK_team_memberships_teamId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_memberships" DROP CONSTRAINT "FK_team_memberships_membershipId"`,
    );
    await queryRunner.query(`DROP TABLE "team_memberships"`);
  }
}
