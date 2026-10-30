import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Where billing mail goes, when it should not be the founder's login email.
 * Nullable with no default: null means "nobody has set one", and the
 * owner's address answers instead, so every existing Organisation keeps
 * exactly the behaviour it had.
 */
export class AddOrganisationBillingEmail1791040000000 implements MigrationInterface {
  name = 'AddOrganisationBillingEmail1791040000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organisations" ADD "billingEmail" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organisations" DROP COLUMN "billingEmail"`,
    );
  }
}
