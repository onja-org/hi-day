import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Projects an invitee is added to (as a project member) when they accept —
 * see InvitationsService.accept. A plain uuid array rather than a join
 * table: it's only ever read back whole at accept/resend time, and ids
 * of projects deleted or archived in the meantime are skipped then.
 */
export class AddInvitationProjectIds1790200000000 implements MigrationInterface {
  name = 'AddInvitationProjectIds1790200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invitations" ADD "projectIds" uuid array NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invitations" DROP COLUMN "projectIds"`,
    );
  }
}
