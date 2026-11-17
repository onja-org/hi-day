import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Whether the admin who sent an invitation, or made an invite link, agreed
 * to an extra seat being charged on the spot (ADR 0033). The consent was
 * only ever asked in the forms, so an invitation sent while seats were free
 * and accepted after they filled was charged with nobody having agreed.
 * Existing rows are `false`: none of them carried consent to the server, so
 * a join through one is billed on the next invoice rather than at once.
 */
export class AddSeatChargeConsent1791160000000 implements MigrationInterface {
  name = 'AddSeatChargeConsent1791160000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invitations" ADD "seatChargeConsent" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "invite_links" ADD "seatChargeConsent" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invite_links" DROP COLUMN "seatChargeConsent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitations" DROP COLUMN "seatChargeConsent"`,
    );
  }
}
