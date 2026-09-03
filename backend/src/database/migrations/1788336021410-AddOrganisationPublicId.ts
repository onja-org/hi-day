import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrganisationPublicId1788336021410 implements MigrationInterface {
  name = 'AddOrganisationPublicId1788336021410';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organisations" ADD "publicId" SERIAL NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "organisations" ADD CONSTRAINT "UQ_4313de143ef981a98dde81969ac" UNIQUE ("publicId")`,
    );
    // Start the sequence at 100000 so a publicId reads as a tidy 6-digit
    // number instead of counting up from 1, and backfill any existing
    // rows (there's no data to lose here — the sequence is brand new)
    // onto that same range instead of leaving them at 1, 2, ...
    await queryRunner.query(
      `SELECT setval(pg_get_serial_sequence('organisations', 'publicId'), 100000, false)`,
    );
    await queryRunner.query(
      `UPDATE "organisations" SET "publicId" = nextval(pg_get_serial_sequence('organisations', 'publicId'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organisations" DROP CONSTRAINT "UQ_4313de143ef981a98dde81969ac"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organisations" DROP COLUMN "publicId"`,
    );
  }
}
