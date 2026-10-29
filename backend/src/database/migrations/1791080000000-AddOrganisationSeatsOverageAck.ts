import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The member count an admin last acknowledged being over their paid seats
 * at. Nullable: nobody has acknowledged anything yet, which is the truth for
 * every existing Organisation.
 */
export class AddOrganisationSeatsOverageAck1791080000000 implements MigrationInterface {
  name = 'AddOrganisationSeatsOverageAck1791080000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organisations" ADD "seatsOverageAcknowledgedAtMembers" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organisations" DROP COLUMN "seatsOverageAcknowledgedAtMembers"`,
    );
  }
}
