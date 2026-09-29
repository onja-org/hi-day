import dataSource from '../database/data-source';

/**
 * One-off sweep for captures orphaned *before* capture pruning existed.
 *
 * App events and URL sessions have no foreign key to a Time entry — they're
 * attributed to a Membership and a moment, and the read side works out which
 * entry covered them. Entries deleted or shortened before
 * `CaptureCleanupService` was added therefore left captures behind, which
 * the Activity views label "Untracked".
 *
 * Reports counts and exits unless `--apply` is passed. Run it, read the
 * numbers, then run it again to delete:
 *
 *   pnpm --filter backend prune:orphaned-captures
 *   pnpm --filter backend prune:orphaned-captures --apply
 *
 * Screenshots are deliberately untouched: their stored objects would have to
 * go too, which a SQL sweep can't do.
 */

/** An app event is a single instant, so it is covered or it isn't. */
const ORPHANED_APP_EVENTS = `
  FROM app_events ae
  WHERE NOT EXISTS (
    SELECT 1 FROM time_entries te
    WHERE te."membershipId" = ae."membershipId"
      AND te."startedAt" <= ae."sampledAt"
      AND (te."endedAt" IS NULL OR te."endedAt" > ae."sampledAt")
  )
`;

/**
 * A URL session is a span, so it counts as covered while *any* of it is —
 * matching CaptureCleanupService, which keeps a session that runs past an
 * entry's end rather than discarding the part still covered.
 */
const ORPHANED_URL_SESSIONS = `
  FROM url_sessions us
  WHERE NOT EXISTS (
    SELECT 1 FROM time_entries te
    WHERE te."membershipId" = us."membershipId"
      AND te."startedAt" < us."endedAt"
      AND (te."endedAt" IS NULL OR te."endedAt" > us."startedAt")
  )
`;

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  await dataSource.initialize();

  try {
    const [appEvents] = await dataSource.query<{ count: string }[]>(
      `SELECT COUNT(*)::text AS count ${ORPHANED_APP_EVENTS}`,
    );
    const [urlSessions] = await dataSource.query<{ count: string }[]>(
      `SELECT COUNT(*)::text AS count ${ORPHANED_URL_SESSIONS}`,
    );

    console.log(`Orphaned app events:   ${appEvents.count}`);
    console.log(`Orphaned URL sessions: ${urlSessions.count}`);

    if (!apply) {
      console.log(
        '\nDry run — nothing deleted. Re-run with --apply to delete.',
      );
      return;
    }

    // One transaction: a half-applied sweep would leave the counts above
    // meaningless on a re-run.
    await dataSource.transaction(async (manager) => {
      await manager.query(`DELETE ${ORPHANED_APP_EVENTS}`);
      await manager.query(`DELETE ${ORPHANED_URL_SESSIONS}`);
    });

    console.log('\nDeleted.');
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
