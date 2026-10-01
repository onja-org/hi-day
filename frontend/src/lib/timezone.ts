/** Where a timezone came from, so the selector can label each option. */
export type TimezoneSource = "member" | "viewer" | "organisation";

/** The browser's own zone — what "my timezone" means, and what gets reported
 * to the server so others can read a timesheet in this person's local time. */
export function detectTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** ICU's own name for a zone, in the requested width, on a given date. */
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
 * ICU's short name is preferred where it gives a real abbreviation, but for
 * most of the world it answers with a GMT offset instead ("GMT+3" for
 * Africa/Nairobi). In that case the initials of its *long* name are the
 * abbreviation: "East Africa Time" is EAT, "Japan Standard Time" is JST.
 *
 * The date matters — the same zone reads "EST" or "EDT" by season.
 *
 * Known imprecision: ICU writes European winter time as "Central European
 * Standard Time", so this yields CEST where CET is conventional. Wrong-ish
 * label, right zone; nothing downstream reads it.
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
  // A single-word name ("Greenwich"?) initials down to noise — keep ICU's
  // own answer rather than inventing a one-letter abbreviation.
  return initials.length >= 2 ? initials : (short ?? long);
}

/** "Indian - Antananarivo" from "Indian/Antananarivo" — area and city,
 * spelled for reading rather than for lookup. */
export function timezoneLabel(zone: string): string {
  return zone.split("/").join(" - ").replace(/_/g, " ");
}

/** "EAT: Indian - Antananarivo", the form the selector lists. */
export function describeTimezone(zone: string, at: Date = new Date()): string {
  return `${timezoneAbbreviation(zone, at)}: ${timezoneLabel(zone)}`;
}

/**
 * The calendar date an instant falls on *in a given zone*, as YYYY-MM-DD.
 *
 * This is the distinction the whole feature turns on: an entry has one
 * instant, but the day it belongs to is a function of the zone you read it
 * in. `en-CA` is used because it formats as YYYY-MM-DD natively.
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

/** The instant read back as if its zone's clock were UTC, so two readings
 * can be compared numerically. */
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
 * Found by correction rather than arithmetic: the offset is the very thing
 * being solved for, so it can't simply be added. Reading the clock back at a
 * guess and shifting by the difference converges in two passes, which is
 * what makes it right across a daylight-saving boundary, where the offset
 * before and after the guess differ.
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

/** The instant the day *after* `dateKey` begins — a day's exclusive end,
 * which is a day's length only when no DST transition falls inside it. */
export function endOfDayInZone(dateKey: string, zone: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return startOfDayInZone(
    `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`,
    zone,
  );
}

/**
 * Calendar arithmetic on a YYYY-MM-DD key.
 *
 * A date key carries no timezone, so it is manipulated through UTC getters
 * — using local ones would let the runtime's own offset shift the answer by
 * a day, which is the bug this whole module exists to avoid.
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

/** Months, by calendar rather than by 30 days — clamped to the last day
 * when the target month is shorter (31 Mar minus a month is 28 Feb). */
export function subMonthsFromKey(dateKey: string, months: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month - months, 0)).getUTCDate();
  return toKey(
    new Date(Date.UTC(year, month - 1 - months, Math.min(day, lastDay))),
  );
}

function toKey(at: Date): string {
  return [
    at.getUTCFullYear(),
    String(at.getUTCMonth() + 1).padStart(2, "0"),
    String(at.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * The instant whose *runtime-local* clock reads the same as `zone`'s clock
 * does at `instant`.
 *
 * For libraries that lay things out by a Date's local wall-clock and offer
 * no timezone of their own — react-big-calendar being the one here. Shifting
 * the Date makes the library place a block where the chosen zone says it
 * belongs, instead of where the viewer's machine does.
 *
 * The result is a *display* value and nothing else: it is not the instant
 * anything happened, and must never be stored, sent, or used to identify an
 * entry.
 */
export function asZonedWallClock(instant: Date, zone: string): Date {
  const zoneClock = readClockAsUtc(instant, zone);
  const localClock = readClockAsUtc(instant, detectTimezone());
  return new Date(instant.getTime() + (zoneClock - localClock));
}
