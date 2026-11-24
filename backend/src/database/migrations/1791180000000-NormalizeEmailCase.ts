import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Emails become case-insensitive: every stored address is trimmed and
 * lowercased (the form `normalizeEmail` now writes and looks up), and a
 * unique index on `lower(email)` stops a second account for the same person
 * slipping in under different capitalisation.
 *
 * Before this, signup and login kept whatever case was typed while
 * invitations lowercased — so `Jane@corp.com` couldn't log in as
 * `jane@corp.com`, and accepting an invite could create a duplicate user.
 *
 * Refuses to run if two existing users differ only by case/whitespace:
 * which one is the real account (memberships, time entries, billing) is a
 * human decision, so they must be merged by hand first. The error lists them.
 */
export class NormalizeEmailCase1791180000000 implements MigrationInterface {
  name = 'NormalizeEmailCase1791180000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const collisions = (await queryRunner.query(
      `SELECT lower(btrim("email")) AS "normalized", array_agg("email" ORDER BY "createdAt") AS "emails"
         FROM "users"
         GROUP BY lower(btrim("email"))
         HAVING count(*) > 1`,
    )) as { normalized: string; emails: string[] }[];
    if (collisions.length > 0) {
      const list = collisions
        .map((c) => `  ${c.normalized}: ${c.emails.join(', ')}`)
        .join('\n');
      throw new Error(
        `Cannot normalise email case: ${collisions.length} address(es) belong to more than one user. ` +
          `Merge or rename these accounts first, then re-run:\n${list}`,
      );
    }

    await queryRunner.query(
      `UPDATE "users" SET "email" = lower(btrim("email")) WHERE "email" <> lower(btrim("email"))`,
    );
    await queryRunner.query(
      `UPDATE "invitations" SET "email" = lower(btrim("email")) WHERE "email" <> lower(btrim("email"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_email_lower" ON "users" (lower("email"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The original casing isn't recoverable; only the index is undone.
    await queryRunner.query(`DROP INDEX "UQ_users_email_lower"`);
  }
}
