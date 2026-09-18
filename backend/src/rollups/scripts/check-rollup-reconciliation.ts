import { In } from 'typeorm';
import {
  NO_PAUSE_STATE,
  activeSeconds,
  resolvePauseStates,
} from '../../common/time-entry-active-seconds.util';
import dataSource from '../../database/data-source';
import { Rollup } from '../../database/entities/rollup.entity';
import { TimeEntry } from '../../database/entities/time-entry.entity';
import { TimeEntryPause } from '../../database/entities/time-entry-pause.entity';

// Per-entry seconds are rounded independently on both sides (raw and
// rollup), so a handful of entries rounding in opposite directions can
// separate the two totals by a second or two without indicating a real
// bug — matches the "small tolerance" the reporting spec itself asks for.
const TOLERANCE_SECONDS = 2;

/**
 * Verifies every `Rollup` row agrees with what its underlying `TimeEntry`
 * rows actually say — the check that proves `TimeEntriesService`'s
 * recompute wiring is exhaustive (a missed call site shows up here as a
 * mismatch, not silently). Only *completed* entries are compared: a
 * still-running entry's contribution grows every second by design (see
 * `RollupService.recomputeDay`'s doc comment) and isn't a promise any
 * rollup row makes until it stops, so including it here would flag
 * expected, harmless drift as a false failure.
 *
 * Usage: `pnpm --filter backend rollups:check`
 */
async function main(): Promise<void> {
  await dataSource.initialize();
  const manager = dataSource.manager;

  const entries = await manager.find(TimeEntry);
  const completedEntries = entries.filter((entry) => entry.endedAt !== null);

  const pauses = completedEntries.length
    ? await manager.find(TimeEntryPause, {
        where: { timeEntryId: In(completedEntries.map((entry) => entry.id)) },
      })
    : [];
  const pauseStates = resolvePauseStates(pauses);
  const now = new Date();

  const rawTotals = new Map<string, number>();
  for (const entry of completedEntries) {
    const key = `${entry.membershipId}|${entry.projectId}`;
    const seconds = activeSeconds(
      entry,
      pauseStates.get(entry.id) ?? NO_PAUSE_STATE,
      now,
    );
    rawTotals.set(key, (rawTotals.get(key) ?? 0) + seconds);
  }

  const rollups = await manager.find(Rollup);
  const rollupTotals = new Map<string, number>();
  for (const rollup of rollups) {
    const key = `${rollup.membershipId}|${rollup.projectId}`;
    rollupTotals.set(key, (rollupTotals.get(key) ?? 0) + rollup.workedSeconds);
  }

  const allKeys = new Set([...rawTotals.keys(), ...rollupTotals.keys()]);
  let mismatches = 0;
  for (const key of allKeys) {
    const raw = rawTotals.get(key) ?? 0;
    const rolled = rollupTotals.get(key) ?? 0;
    const diff = Math.abs(raw - rolled);
    if (diff > TOLERANCE_SECONDS) {
      mismatches += 1;
      console.error(
        `MISMATCH ${key}: raw=${raw}s rollup=${rolled}s diff=${diff}s`,
      );
    }
  }

  console.log(`Checked ${allKeys.size} (membership, project) pairs.`);
  if (mismatches > 0) {
    console.error(
      `${mismatches} mismatch(es) beyond ${TOLERANCE_SECONDS}s tolerance.`,
    );
    await dataSource.destroy();
    process.exit(1);
  }

  console.log('All rollups match raw data within tolerance.');
  await dataSource.destroy();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
