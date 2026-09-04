import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameProjectMembershipRoleAdminToManager1788450000000 implements MigrationInterface {
  name = 'RenameProjectMembershipRoleAdminToManager1788450000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."ProjectMembershipRole" RENAME VALUE 'admin' TO 'manager'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."ProjectMembershipRole" RENAME VALUE 'manager' TO 'admin'`,
    );
  }
}
