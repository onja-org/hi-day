/** Where a timezone came from, so the selector can label each option. */
export type TimezoneSource = "member" | "viewer" | "organisation";

/** The browser's own zone — what "my time zone" means. */
export function detectTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** ICU's own name for a zone, at the given width and date. */
function zoneName(
  zone: string,
  at: Date,
  width: "short" | "long",
): string | undefined {
  return new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: width })
    .formatToParts(at)
    .find((part) => part.type === "timeZoneName")?.value;
}

/**
 * The abbreviation a zone goes by on a given date — "EAT", "EST", "IST".
 *
 * ICU's short name is a GMT offset for most of the world ("GMT+3" for
 * Africa/Nairobi); there, the initials of its long name are the
 * abbreviation. The date matters: a zone reads "EST" or "EDT" by season.
 *
 * Imprecise for Europe, where ICU says "Central European Standard Time" and
 * so yields CEST where CET is conventional. Nothing downstream reads it.
 */
export function timezoneAbbreviation(zone: string, at: Date = new Date()): string {
  const short = zoneName(zone, at, "short");
  if (short && !short.startsWith("GMT")) {
    return short;
  }
  const long = zoneName(zone, at, "long");
  if (!long) {
    return short ?? zone;
  }
  const initials = long
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  // A one-word name initials down to one letter, which is not an abbreviation.
  return initials.length >= 2 ? initials : (short ?? long);
}

/** "Indian/Antananarivo" spelled for reading: "Indian - Antananarivo". */
export function timezoneLabel(zone: string): string {
  return zone.split("/").join(" - ").replace(/_/g, " ");
}

/** "EAT: Indian - Antananarivo", the form the selector lists. */
export function describeTimezone(zone: string, at: Date = new Date()): string {
  return `${timezoneAbbreviation(zone, at)}: ${timezoneLabel(zone)}`;
}

/**
 * The calendar date an instant falls on *in a given zone*, as YYYY-MM-DD —
 * the distinction the feature turns on, since one instant is Monday in
 * Nairobi and Sunday in New York. `en-CA` formats that way natively.
 */
export function dateKeyInZone(value: string | Date, zone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

/** A wall-clock time as read in `zone`, e.g. "1:21 PM". */
export function formatTimeInZone(value: string | Date, zone: string): string {
  return new Intl.DateTimeFormat([], {
    timeZone: zone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

/** A zone's clock read back as if it were UTC, so two can be subtracted. */
function readClockAsUtc(at: Date, zone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const get = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  // Midnight can come back as hour 24 under hourCycle h24.
  return Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
}

/**
 * The instant a calendar day begins in `zone`.
 *
 * By correction, not arithmetic: the offset is the thing being solved for,
 * so it can't simply be added. Re-reading the clock at a guess and shifting
 * by the difference converges in two passes, DST boundaries included.
 */
export function startOfDayInZone(dateKey: string, zone: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const wanted = Date.UTC(year, month - 1, day);
  let guess = wanted;
  for (let pass = 0; pass < 2; pass += 1) {
    guess += wanted - readClockAsUtc(new Date(guess), zone);
  }
  return new Date(guess);
}

/** The instant the day after `dateKey` begins — a day's exclusive end. */
export function endOfDayInZone(dateKey: string, zone: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return startOfDayInZone(
    `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`,
    zone,
  );
}

/**
 * Calendar arithmetic on a YYYY-MM-DD key. Through UTC getters: a key
 * carries no zone, and local ones would let the runtime's own offset shift
 * the answer by a day.
 */
export function addDaysToKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return toKey(new Date(Date.UTC(year, month - 1, day + days)));
}

/** Monday-start, matching the date picker's calendar grid. */
export function startOfWeekKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const at = new Date(Date.UTC(year, month - 1, day));
  // getUTCDay is 0 for Sunday, which is 6 days into a Monday-start week.
  const offset = (at.getUTCDay() + 6) % 7;
  return addDaysToKey(dateKey, -offset);
}

export function endOfWeekKey(dateKey: string): string {
  return addDaysToKey(startOfWeekKey(dateKey), 6);
}

export function startOfMonthKey(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`;
}

export function endOfMonthKey(dateKey: string): string {
  const [year, month] = dateKey.split("-").map(Number);
  // Day 0 of the next month is the last day of this one.
  return toKey(new Date(Date.UTC(year, month, 0)));
}

/** Months by calendar, clamped when the target is shorter: 31 Mar - 1 month
 * is 28 Feb. */
export function subMonthsFromKey(dateKey: string, months: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month - months, 0)).getUTCDate();
  return toKey(
    new Date(Date.UTC(year, month - 1 - months, Math.min(day, lastDay))),
  );
}

/**
 * A day key as a runtime-local Date, and back. Calendar UIs lay out in
 * local days, so a key crossing that boundary has to put on and take off
 * the runtime's own offset — these are the only two places that happens.
 */
export function keyAsLocalDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function localDateToKey(at: Date): string {
  return [
    at.getFullYear(),
    String(at.getMonth() + 1).padStart(2, "0"),
    String(at.getDate()).padStart(2, "0"),
  ].join("-");
}

function toKey(at: Date): string {
  return [
    at.getUTCFullYear(),
    String(at.getUTCMonth() + 1).padStart(2, "0"),
    String(at.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * The instant whose runtime-local clock reads the same as `zone`'s does at
 * `instant` — for react-big-calendar, which lays out by a Date's local
 * clock and has no zone of its own.
 *
 * Display only: not when anything happened, so never store or send it.
 */
export function asZonedWallClock(instant: Date, zone: string): Date {
  const zoneClock = readClockAsUtc(instant, zone);
  const localClock = readClockAsUtc(instant, detectTimezone());
  return new Date(instant.getTime() + (zoneClock - localClock));
}
