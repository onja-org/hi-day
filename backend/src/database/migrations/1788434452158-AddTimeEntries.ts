import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTimeEntries1788434452158 implements MigrationInterface {
  name = 'AddTimeEntries1788434452158';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "time_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "startedAt" TIMESTAMP(3) NOT NULL, "endedAt" TIMESTAMP(3) NOT NULL, "note" text, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "organisationId" uuid NOT NULL, CONSTRAINT "PK_b8bc5f10269ba2fe88708904aa0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "time_entries" ADD CONSTRAINT "FK_d1b452d7f0d45863303b7d30000" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "time_entries" ADD CONSTRAINT "FK_e7e6fd3ea0a71abd0f74a965cb7" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "time_entries" DROP CONSTRAINT "FK_e7e6fd3ea0a71abd0f74a965cb7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "time_entries" DROP CONSTRAINT "FK_d1b452d7f0d45863303b7d30000"`,
    );
    await queryRunner.query(`DROP TABLE "time_entries"`);
  }
}
