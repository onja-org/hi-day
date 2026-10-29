import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * How many seats an Organisation has bought. Nullable with no default: null
 * means none were ever bought, which is every existing Organisation, and
 * billing then falls back to counting active members exactly as it did.
 */
export class AddOrganisationPurchasedSeats1791050000000 implements MigrationInterface {
  name = 'AddOrganisationPurchasedSeats1791050000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organisations" ADD "purchasedSeats" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organisations" DROP COLUMN "purchasedSeats"`,
    );
  }
}
