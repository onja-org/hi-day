export interface TimeEntryCoverageWindow {
  id: string;
  projectId: string;
  startedAt: Date;
  /** null = still running — covers everything from `startedAt` onward. */
  endedAt: Date | null;
}

/**
 * The entry (if any) covering instant `at` — overlap semantics, not
 * containment. Used to attribute a tracked app/URL/screenshot sample to
 * whichever project the member was timing at that moment. A `TimeEntry`
 * routinely spans the query window — still running, or started the
 * previous day — so callers must fetch entries with an overlap query (see
 * `TimeEntriesService.listCoveringWindow`), not a containment query.
 */
export function findEntryCovering<T extends TimeEntryCoverageWindow>(
  entries: T[],
  at: Date,
): T | undefined {
  return entries.find(
    (entry) =>
      entry.startedAt <= at && (entry.endedAt === null || at < entry.endedAt),
  );
}
