import { MigrationInterface, QueryRunner } from 'typeorm';

/** Hand-written, same reasoning as `1789050000000-CreateActivitySamples`. */
export class CreateNotes1789620000000 implements MigrationInterface {
  name = 'CreateNotes1789620000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organisationId" uuid NOT NULL,
        "membershipId" uuid NOT NULL,
        "projectId" uuid,
        "noteDate" date NOT NULL,
        "content" text NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notes_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_notes_organisationId_membershipId_noteDate" ON "notes" ("organisationId", "membershipId", "noteDate")`,
    );
    await queryRunner.query(`
      ALTER TABLE "notes" ADD CONSTRAINT "FK_notes_organisationId"
      FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "notes" ADD CONSTRAINT "FK_notes_membershipId"
      FOREIGN KEY ("membershipId") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "notes" ADD CONSTRAINT "FK_notes_projectId"
      FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notes"`);
  }
}
