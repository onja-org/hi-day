import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActivities1788421447643 implements MigrationInterface {
  name = 'AddActivities1788421447643';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "activities" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "content" text NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "organisationId" uuid NOT NULL, CONSTRAINT "PK_7f4004429f731ffb9c88eb486a8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" ADD CONSTRAINT "FK_5a2cfe6f705df945b20c1b22c71" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" ADD CONSTRAINT "FK_e7b4422f598a91d72f437348dd8" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "activities" DROP CONSTRAINT "FK_e7b4422f598a91d72f437348dd8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" DROP CONSTRAINT "FK_5a2cfe6f705df945b20c1b22c71"`,
    );
    await queryRunner.query(`DROP TABLE "activities"`);
  }
}
