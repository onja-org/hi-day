import dataSource from '../../database/data-source';
import { TimeEntry } from '../../database/entities/time-entry.entity';
import { RollupService } from '../services/rollup.service';

const PROGRESS_INTERVAL = 100;

/**
 * One-off: populates `Rollup` rows for every (membership, project, day) that
 * already has `TimeEntry` history — needed once, when this feature first
 * ships, since the hourly/nightly job that keeps rollups current only ever
 * computes forward from when it starts running. Safe to re-run: every
 * write goes through `RollupService.recomputeDay`'s upsert, so running
 * this twice just recomputes the same rows to the same values.
 *
 * Usage: `pnpm --filter backend rollups:backfill`
 */
async function main(): Promise<void> {
  await dataSource.initialize();
  const manager = dataSource.manager;
  const rollupService = new RollupService();

  const entries = await manager.find(TimeEntry, {
    select: {
      organisationId: true,
      membershipId: true,
      projectId: true,
      startedAt: true,
    },
  });

  // Dedupe to one (membership, project, local calendar day) triple per
  // recompute — a busy day with dozens of entries only needs one pass, not
  // one per entry. The exact day-start boundary is `recomputeDay`'s own
  // job; this key only needs to be stable per calendar day, not exact.
  const seen = new Set<string>();
  const buckets: {
    organisationId: string;
    membershipId: string;
    projectId: string;
    day: Date;
  }[] = [];

  for (const entry of entries) {
    const key = `${entry.membershipId}|${entry.projectId}|${entry.startedAt.getFullYear()}-${entry.startedAt.getMonth()}-${entry.startedAt.getDate()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    buckets.push({
      organisationId: entry.organisationId,
      membershipId: entry.membershipId,
      projectId: entry.projectId,
      day: entry.startedAt,
    });
  }

  console.log(`Backfilling ${buckets.length} rollup rows...`);

  let done = 0;
  for (const bucket of buckets) {
    await rollupService.recomputeDay(manager, bucket);
    done += 1;
    if (done % PROGRESS_INTERVAL === 0) {
      console.log(`  ${done}/${buckets.length}`);
    }
  }

  console.log(`Done. Backfilled ${buckets.length} rollup rows.`);
  await dataSource.destroy();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
