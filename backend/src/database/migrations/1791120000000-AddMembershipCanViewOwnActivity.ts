import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-member override of the Organisation's "Members can see their own
 * activity" setting. Nullable: `NULL` means inherit the org default. No
 * backfill — the org default itself resolves to `true` when unset (see
 * `DEFAULT_MEMBERS_CAN_VIEW_OWN_ACTIVITY`), so every existing member keeps
 * seeing their own activity without touching a row.
 */
export class AddMembershipCanViewOwnActivity1791120000000 implements MigrationInterface {
  name = 'AddMembershipCanViewOwnActivity1791120000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD "canViewOwnActivity" boolean`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "memberships" DROP COLUMN "canViewOwnActivity"`,
    );
  }
}
