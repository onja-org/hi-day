import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectMembershipViewerRole1790600000000 implements MigrationInterface {
  name = 'AddProjectMembershipViewerRole1790600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."ProjectMembershipRole" ADD VALUE IF NOT EXISTS 'viewer'`,
    );
  }

  // Postgres can't drop a single enum value, so viewers become plain
  // members and the type is rebuilt without 'viewer'.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "project_memberships" SET "role" = 'member' WHERE "role" = 'viewer'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."ProjectMembershipRole" RENAME TO "ProjectMembershipRole_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ProjectMembershipRole" AS ENUM('manager', 'member')`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_memberships" ALTER COLUMN "role" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_memberships" ALTER COLUMN "role" TYPE "public"."ProjectMembershipRole" USING "role"::text::"public"."ProjectMembershipRole"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_memberships" ALTER COLUMN "role" SET DEFAULT 'member'`,
    );
    await queryRunner.query(`DROP TYPE "public"."ProjectMembershipRole_old"`);
  }
}
