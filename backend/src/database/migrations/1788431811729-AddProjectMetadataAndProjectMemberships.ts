import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectMetadataAndProjectMemberships1788431811729 implements MigrationInterface {
  name = 'AddProjectMetadataAndProjectMemberships1788431811729';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "project_memberships" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "rate" numeric(10,2), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(), "projectId" uuid NOT NULL, "membershipId" uuid NOT NULL, CONSTRAINT "UQ_a4c2ba5d69c013606ef28f723c9" UNIQUE ("projectId", "membershipId"), CONSTRAINT "PK_856d7bae2d9bddc94861d41eded" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD "client" character varying`,
    );
    await queryRunner.query(`ALTER TABLE "projects" ADD "description" text`);
    await queryRunner.query(
      `CREATE TYPE "public"."ProjectColour" AS ENUM('blue', 'green', 'amber', 'red', 'purple', 'teal', 'pink', 'gray')`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD "colour" "public"."ProjectColour" NOT NULL DEFAULT 'blue'`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "UQ_324ceb2f1a4db153f58027d79d5" UNIQUE ("organisationId", "name")`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_memberships" ADD CONSTRAINT "FK_5f19347882ccafc35f4c7293abd" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_memberships" ADD CONSTRAINT "FK_9676e5713f037dada4142721775" FOREIGN KEY ("membershipId") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_memberships" DROP CONSTRAINT "FK_9676e5713f037dada4142721775"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_memberships" DROP CONSTRAINT "FK_5f19347882ccafc35f4c7293abd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" DROP CONSTRAINT "UQ_324ceb2f1a4db153f58027d79d5"`,
    );
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "colour"`);
    await queryRunner.query(`DROP TYPE "public"."ProjectColour"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "description"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "client"`);
    await queryRunner.query(`DROP TABLE "project_memberships"`);
  }
}
