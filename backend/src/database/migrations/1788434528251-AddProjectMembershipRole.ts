import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectMembershipRole1788434528251 implements MigrationInterface {
  name = 'AddProjectMembershipRole1788434528251';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."ProjectMembershipRole" AS ENUM('admin', 'member')`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_memberships" ADD "role" "public"."ProjectMembershipRole" NOT NULL DEFAULT 'member'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_memberships" DROP COLUMN "role"`,
    );
    await queryRunner.query(`DROP TYPE "public"."ProjectMembershipRole"`);
  }
}
