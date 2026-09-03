import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskFields1788441821415 implements MigrationInterface {
  name = 'AddTaskFields1788441821415';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" ADD "description" text`);
    await queryRunner.query(`ALTER TABLE "tasks" ADD "estimate" numeric(6,2)`);
    await queryRunner.query(`ALTER TABLE "tasks" ADD "dueDate" date`);
    await queryRunner.query(`ALTER TABLE "tasks" ADD "closedAt" TIMESTAMP(3)`);
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD "assigneeProjectMembershipId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_b69259640a7503b583ae462daaf" FOREIGN KEY ("assigneeProjectMembershipId") REFERENCES "project_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_b69259640a7503b583ae462daaf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP COLUMN "assigneeProjectMembershipId"`,
    );
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "closedAt"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "dueDate"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "estimate"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "description"`);
  }
}
