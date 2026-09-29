import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskStage1790500000000 implements MigrationInterface {
  name = 'AddTaskStage1790500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "TaskStage" AS ENUM('todo', 'in_progress', 'done')`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD "stage" "TaskStage" NOT NULL DEFAULT 'todo'`,
    );
    // Closed tasks start in Done, matching the closedAt <-> DONE rule.
    await queryRunner.query(
      `UPDATE "tasks" SET "stage" = 'done' WHERE "closedAt" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "stage"`);
    await queryRunner.query(`DROP TYPE "TaskStage"`);
  }
}
