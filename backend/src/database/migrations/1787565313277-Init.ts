import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1787565313277 implements MigrationInterface {
  name = 'Init1787565313277';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "MembershipRole" AS ENUM ('admin', 'manager', 'member', 'finance')`,
    );

    await queryRunner.query(`
      CREATE TABLE "organisations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "settings" jsonb NOT NULL DEFAULT '{}',
        "createdAt" timestamp(3) NOT NULL DEFAULT now(),
        "updatedAt" timestamp(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_organisations_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" character varying NOT NULL,
        "name" character varying,
        "createdAt" timestamp(3) NOT NULL DEFAULT now(),
        "updatedAt" timestamp(3) NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "memberships" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "role" "MembershipRole" NOT NULL,
        "createdAt" timestamp(3) NOT NULL DEFAULT now(),
        "userId" uuid NOT NULL,
        "organisationId" uuid NOT NULL,
        CONSTRAINT "UQ_memberships_userId_organisationId" UNIQUE ("userId", "organisationId"),
        CONSTRAINT "PK_memberships_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "memberships"
      ADD CONSTRAINT "FK_memberships_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "memberships"
      ADD CONSTRAINT "FK_memberships_organisationId" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "memberships" DROP CONSTRAINT "FK_memberships_organisationId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" DROP CONSTRAINT "FK_memberships_userId"`,
    );
    await queryRunner.query(`DROP TABLE "memberships"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "organisations"`);
    await queryRunner.query(`DROP TYPE "MembershipRole"`);
  }
}
