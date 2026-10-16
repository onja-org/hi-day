import type { EntityManager } from 'typeorm';
import dataSource from '../database/data-source';

/**
 * One-off: takes one Organisation off Projects. Detaches every time entry
 * and note from its Project and Task (the hours stay, as "No project"),
 * deletes the Projects with their Tasks and assignments, drops the ids from
 * pending invitations, invite links and saved reports, and records
 * `projectsEnabled: false` on the Organisation.
 *
 * Reports counts and exits unless `--apply` is passed. Run it, read the
 * numbers, then run it again to change anything:
 *
 *   pnpm --filter backend remove:organisation-projects --org <publicId>
 *   pnpm --filter backend remove:organisation-projects --org <publicId> --apply
 *
 * Irreversible once applied: take a database backup first. Needs the
 * `MakeTimeEntryProjectOptional` migration to have run.
 */

interface Counts {
  projects: number;
  tasks: number;
  timeEntries: number;
  notes: number;
  projectTeams: number;
  projectMemberships: number;
  invitations: number;
  inviteLinks: number;
  savedReports: number;
}

/** Every statement filters on the Organisation's own Projects, so a bad id
 * can only ever touch that Organisation. */
const PROJECT_IDS = `SELECT "id" FROM "projects" WHERE "organisationId" = $1`;

export async function countAffected(
  manager: EntityManager,
  organisationId: string,
): Promise<Counts> {
  const count = async (sql: string): Promise<number> => {
    const [row] = await manager.query<{ count: string }[]>(
      `SELECT COUNT(*)::text AS count ${sql}`,
      [organisationId],
    );
    return Number(row.count);
  };

  return {
    projects: await count(`FROM "projects" WHERE "organisationId" = $1`),
    tasks: await count(`FROM "tasks" WHERE "projectId" IN (${PROJECT_IDS})`),
    timeEntries: await count(
      `FROM "time_entries" WHERE "organisationId" = $1
         AND ("projectId" IS NOT NULL OR "taskId" IS NOT NULL)`,
    ),
    notes: await count(`FROM "notes" WHERE "projectId" IN (${PROJECT_IDS})`),
    projectTeams: await count(
      `FROM "project_teams" WHERE "projectId" IN (${PROJECT_IDS})`,
    ),
    projectMemberships: await count(
      `FROM "project_memberships" WHERE "projectId" IN (${PROJECT_IDS})`,
    ),
    invitations: await count(
      `FROM "invitations" WHERE "organisationId" = $1
         AND cardinality("projectIds") > 0`,
    ),
    inviteLinks: await count(
      `FROM "invite_links" WHERE "organisationId" = $1
         AND cardinality("projectIds") > 0`,
    ),
    savedReports: await count(
      `FROM "saved_reports" WHERE "organisationId" = $1
         AND jsonb_array_length(COALESCE("settings"->'filters'->'projectIds', '[]'::jsonb)) > 0`,
    ),
  };
}

/** Order matters: entries and notes let go of the Projects and Tasks before
 * those are deleted, and Tasks go before the Projects that own them. */
export async function removeProjects(
  manager: EntityManager,
  organisationId: string,
): Promise<void> {
  const run = (sql: string): Promise<unknown> =>
    manager.query(sql, [organisationId]);

  await run(
    `UPDATE "time_entries" SET "projectId" = NULL, "taskId" = NULL
     WHERE "organisationId" = $1
       AND ("projectId" IS NOT NULL OR "taskId" IS NOT NULL)`,
  );
  await run(
    `UPDATE "notes" SET "projectId" = NULL
     WHERE "projectId" IN (${PROJECT_IDS})`,
  );
  await run(
    `UPDATE "invitations" SET "projectIds" = '{}'
     WHERE "organisationId" = $1 AND cardinality("projectIds") > 0`,
  );
  await run(
    `UPDATE "invite_links" SET "projectIds" = '{}'
     WHERE "organisationId" = $1 AND cardinality("projectIds") > 0`,
  );
  await run(
    `UPDATE "saved_reports"
     SET "settings" = jsonb_set("settings", '{filters,projectIds}', '[]'::jsonb)
     WHERE "organisationId" = $1
       AND jsonb_array_length(COALESCE("settings"->'filters'->'projectIds', '[]'::jsonb)) > 0`,
  );
  await run(`DELETE FROM "tasks" WHERE "projectId" IN (${PROJECT_IDS})`);
  await run(
    `DELETE FROM "project_teams" WHERE "projectId" IN (${PROJECT_IDS})`,
  );
  await run(
    `DELETE FROM "project_memberships" WHERE "projectId" IN (${PROJECT_IDS})`,
  );
  await run(`DELETE FROM "projects" WHERE "organisationId" = $1`);
  await run(
    `UPDATE "organisations"
     SET "settings" = jsonb_set("settings", '{projectsEnabled}', 'false'::jsonb)
     WHERE "id" = $1`,
  );
}

function readOrgArg(): number {
  const index = process.argv.indexOf('--org');
  const publicId = Number(process.argv[index + 1]);
  if (index === -1 || !Number.isInteger(publicId)) {
    throw new Error('Pass the Organisation with --org <publicId>.');
  }
  return publicId;
}

async function main(): Promise<void> {
  const publicId = readOrgArg();
  const apply = process.argv.includes('--apply');
  await dataSource.initialize();

  try {
    const [organisation] = await dataSource.query<
      { id: string; name: string }[]
    >(`SELECT "id", "name" FROM "organisations" WHERE "publicId" = $1`, [
      publicId,
    ]);
    if (!organisation) {
      throw new Error(`No Organisation has public id ${publicId}.`);
    }

    console.log(`Organisation: ${organisation.name} (${publicId})\n`);
    const counts = await countAffected(dataSource.manager, organisation.id);
    console.log(`Projects to delete:                 ${counts.projects}`);
    console.log(`  Tasks deleted with them:          ${counts.tasks}`);
    console.log(`  Project teams unassigned:         ${counts.projectTeams}`);
    console.log(
      `  Project memberships removed:      ${counts.projectMemberships}`,
    );
    console.log(`Time entries detached (kept):       ${counts.timeEntries}`);
    console.log(`Notes detached (kept):              ${counts.notes}`);
    console.log(`Invitations cleared of projects:    ${counts.invitations}`);
    console.log(`Invite links cleared of projects:   ${counts.inviteLinks}`);
    console.log(`Saved reports cleared of filters:   ${counts.savedReports}`);

    if (!apply) {
      console.log(
        '\nDry run — nothing changed. Back up the database, then re-run with --apply.',
      );
      return;
    }

    // One transaction: a half-applied removal would leave entries pointing
    // at Projects that no longer exist, or Projects with no entries.
    await dataSource.transaction((manager) =>
      removeProjects(manager, organisation.id),
    );

    console.log('\nDone. Projects are now off for this Organisation.');
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
