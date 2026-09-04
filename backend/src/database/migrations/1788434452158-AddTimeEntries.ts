import { MigrationInterface } from 'typeorm';

export class AddTimeEntries1788434452158 implements MigrationInterface {
  name = 'AddTimeEntries1788434452158';

  // This migration's original body (a bare `CREATE TABLE "time_entries"`
  // for a simple note-based logging design) has never successfully run
  // against any shared database — it always failed with "relation
  // time_entries already exists", because CreateTimeEntries1788504732663
  // (a later timestamp, but the one actually merged into production
  // earlier) already created the real, final time_entries schema
  // (project/task/membership/source-attributed, not note/userId). That
  // migration's own `up()` already carries a `DROP TABLE IF EXISTS` guard
  // for the reverse ordering; this one just needs to get out of the way
  // when it runs *after* the real table already exists. Left as a no-op
  // rather than deleted, since TypeORM still needs this migration's name
  // recorded as applied for `migration:run` to move past it.
  public async up(): Promise<void> {}

  public async down(): Promise<void> {}
}
