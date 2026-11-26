import { APP_EVENT_SAMPLE_SECONDS } from '../common/app-event-samples.util';
import dataSource from '../database/data-source';

/**
 * One-off sweep for captures orphaned *before* capture pruning existed.
 *
 * App events and URL sessions have no foreign key to a Time entry — they're
 * attributed to a Membership and a moment, and the read side works out which
 * entry covered them. Entries deleted or shortened before
 * `CaptureCleanupService` was added therefore left captures behind, which
 * the Activity views label "No project".
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

/** A sample's own instant: `ae`'s run start plus `sample.index` ticks. */
const SAMPLE_AT = `ae."sampledAt" + sample."index" * interval '${APP_EVENT_SAMPLE_SECONDS} seconds'`;

/** No Time entry of the member covers the sample at `SAMPLE_AT`. */
const SAMPLE_UNCOVERED = `NOT EXISTS (
    SELECT 1 FROM time_entries te
    WHERE te."membershipId" = ae."membershipId"
      AND te."startedAt" <= ${SAMPLE_AT}
      AND (te."endedAt" IS NULL OR te."endedAt" > ${SAMPLE_AT})
  )`;

/** Each row expanded into the samples it stands for (see
 * common/app-event-samples.util.ts) — one sample for a run of one. */
const SAMPLES = `app_events ae
  CROSS JOIN LATERAL generate_series(0, GREATEST(ae."sampleCount", 1) - 1) AS sample("index")`;

/**
 * An app event is a single instant, so it is covered or it isn't. A merged
 * run is judged the same way, sample by sample: runs with any uncovered
 * sample are first split back into one-sample rows (SPLIT_RUNS_WITH_ORPHANS),
 * so this rule — the original one — then removes exactly the samples an
 * unmerged agent's rows would have lost, and never a covered one.
 */
const ORPHANED_APP_EVENTS = `
  FROM app_events ae
  WHERE ae."sampleCount" = 1 AND NOT EXISTS (
    SELECT 1 FROM time_entries te
    WHERE te."membershipId" = ae."membershipId"
      AND te."startedAt" <= ae."sampledAt"
      AND (te."endedAt" IS NULL OR te."endedAt" > ae."sampledAt")
  )
`;

/** Counted per sample, so the figure means the same merged or not. */
const COUNT_ORPHANED_APP_SAMPLES = `
  SELECT COUNT(*)::text AS count FROM ${SAMPLES} WHERE ${SAMPLE_UNCOVERED}
`;

/**
 * Replaces every merged run holding an uncovered sample with one row per
 * sample, carrying everything else over unchanged.
 */
const SPLIT_RUNS_WITH_ORPHANS = `
  WITH runs AS (
    SELECT ae.* FROM app_events ae
    WHERE ae."sampleCount" > 1 AND EXISTS (
      SELECT 1 FROM generate_series(0, ae."sampleCount" - 1) AS sample("index")
      WHERE ${SAMPLE_UNCOVERED}
    )
  ),
  split AS (
    INSERT INTO app_events
      ("organisationId", "membershipId", "deviceId", "appName", "title",
       "titleUnavailableReason", "sampledAt", "sampleCount", "createdAt")
    SELECT ae."organisationId", ae."membershipId", ae."deviceId", ae."appName",
           ae."title", ae."titleUnavailableReason", ${SAMPLE_AT}, 1, ae."createdAt"
    FROM runs ae
    CROSS JOIN LATERAL generate_series(0, ae."sampleCount" - 1) AS sample("index")
  )
  DELETE FROM app_events WHERE id IN (SELECT id FROM runs)
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
      COUNT_ORPHANED_APP_SAMPLES,
    );
    const [urlSessions] = await dataSource.query<{ count: string }[]>(
      `SELECT COUNT(*)::text AS count ${ORPHANED_URL_SESSIONS}`,
    );

    console.log(`Orphaned app samples:  ${appEvents.count}`);
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
      await manager.query(SPLIT_RUNS_WITH_ORPHANS);
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
