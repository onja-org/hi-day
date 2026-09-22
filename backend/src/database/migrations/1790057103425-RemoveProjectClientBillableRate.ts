import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveProjectClientBillableRate1790057103425 implements MigrationInterface {
  name = 'RemoveProjectClientBillableRate1790057103425';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "client"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "billable"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "rate"`);
    await queryRunner.query(
      `ALTER TABLE "project_memberships" DROP COLUMN "rate"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_memberships" ADD "rate" numeric(10,2)`,
    );
    await queryRunner.query(`ALTER TABLE "projects" ADD "rate" numeric(10,2)`);
    await queryRunner.query(
      `ALTER TABLE "projects" ADD "billable" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD "client" character varying`,
    );
  }
}
