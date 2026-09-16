import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectTeams1789560961346 implements MigrationInterface {
  name = 'AddProjectTeams1789560961346';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "project_teams" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(), "projectId" uuid NOT NULL, "teamId" uuid NOT NULL, CONSTRAINT "PK_project_teams" PRIMARY KEY ("id"), CONSTRAINT "UQ_project_teams_project_team" UNIQUE ("projectId", "teamId"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_teams" ADD CONSTRAINT "FK_project_teams_projectId" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_teams" ADD CONSTRAINT "FK_project_teams_teamId" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_teams" DROP CONSTRAINT "FK_project_teams_teamId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_teams" DROP CONSTRAINT "FK_project_teams_projectId"`,
    );
    await queryRunner.query(`DROP TABLE "project_teams"`);
  }
}
