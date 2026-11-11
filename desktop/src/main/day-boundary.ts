/**
 * When a day begins, for an agent whose machine may not be in the
 * organisation's timezone.
 *
 * The organisation's zone is the only thing that decides a day on the
 * server — the midnight split, the work-time limits, the week start, the
 * dashboard's buckets and the `workedSeconds` handed to this clock. An
 * agent drawing its own boundary from the machine clock disagrees with all
 * of them for as many hours as the two zones differ.
 *
 * A zone rather than an instant: the agent may be offline for days
 * (docs/adr/0025-...), and a boundary sent as an instant is stale the
 * moment it is crossed.
 */

/** A zone's clock read back as if it were UTC, so two can be subtracted. */
function readClockAsUtc(at: Date, zone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(at);
  const get = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  // Midnight can come back as hour 24 under hourCycle h24.
  return Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second'),
  );
}

/**
 * The instant `at`'s calendar day begins in `zone`.
 *
 * By correction, not arithmetic: the offset is the thing being solved for,
 * so it cannot simply be added. Re-reading the clock at a guess and
 * shifting by the difference converges in two passes, DST boundaries
 * included. The same method as the backend's `startOfDayInZone` and the
 * web's `lib/timezone.ts` — all three have to draw one boundary.
 *
 * Where a zone skips its own midnight — Santiago on the day its DST
 * begins — no instant reads 00:00, and this lands an hour before the day
 * rather than inside it. Left as the server does it: an agent drawing a
 * better boundary than the server it reports to is the worse bug.
 */
export function startOfDayInZone(at: Date, zone: string): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const get = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const wanted = Date.UTC(get('year'), get('month') - 1, get('day'));

  let guess = wanted;
  for (let pass = 0; pass < 2; pass += 1) {
    guess += wanted - readClockAsUtc(new Date(guess), zone);
  }
  return new Date(guess);
}

/** Local midnight on the machine's own clock — what the agent drew before. */
export function startOfLocalDay(at: Date): Date {
  return new Date(at.getFullYear(), at.getMonth(), at.getDate());
}

/**
 * The day boundary to count from: the organisation's when it is known,
 * the machine's when it is not. Unknown covers a backend too old to send
 * one and the first moments of a launch that has reached nobody yet —
 * neither is a reason to stop showing a clock.
 */
export function startOfDay(at: Date, zone: string | null | undefined): Date {
  if (zone) {
    try {
      return startOfDayInZone(at, zone);
    } catch {
      // A zone this runtime cannot read is no better than none.
    }
  }
  return startOfLocalDay(at);
}

/** `YYYY-MM-DD` for `at` in `zone`, or the machine's own when unknown. */
export function dayKey(at: Date, zone: string | null | undefined): string {
  const start = startOfDay(at, zone);
  const pad = (n: number): string => String(n).padStart(2, '0');
  if (!zone) {
    return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}
