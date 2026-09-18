import { MigrationInterface, QueryRunner } from 'typeorm';

// Hand-written rather than `migration:generate`'d: this repo's existing
// tables have explicitly-named FK/index constraints that don't match
// TypeORM's own default naming convention, so a generated diff against
// them churns dozens of unrelated constraint renames with zero functional
// change. Only the actually-new `rollups` table is included here.
export class CreateRollups1789640000000 implements MigrationInterface {
  name = 'CreateRollups1789640000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."RollupPeriodType" AS ENUM('day', 'hour')`,
    );

    await queryRunner.query(`
      CREATE TABLE "rollups" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organisationId" uuid NOT NULL,
        "membershipId" uuid NOT NULL,
        "projectId" uuid NOT NULL,
        "periodType" "public"."RollupPeriodType" NOT NULL,
        "periodStart" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
        "workedSeconds" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rollups_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_rollups_membership_project_period" UNIQUE ("membershipId", "projectId", "periodType", "periodStart"),
        CONSTRAINT "FK_rollups_organisationId" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "FK_rollups_membershipId" FOREIGN KEY ("membershipId") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "FK_rollups_projectId" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_rollups_membershipId" ON "rollups" ("membershipId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rollups_projectId" ON "rollups" ("projectId")`,
    );
    // Backs report queries that group by every rollup for an org over a
    // date range (e.g. "everyone's hours this month") without a specific
    // membershipId/projectId filter.
    await queryRunner.query(
      `CREATE INDEX "IDX_rollups_organisationId_periodType_periodStart" ON "rollups" ("organisationId", "periodType", "periodStart")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "rollups"`);
    await queryRunner.query(`DROP TYPE "public"."RollupPeriodType"`);
  }
}
