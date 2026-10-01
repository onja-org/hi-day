import { describe, expect, it } from "vitest";
import {
  asZonedWallClock,
  dateKeyInZone,
  timezoneAbbreviation,
  describeTimezone,
  endOfDayInZone,
  formatTimeInZone,
  keyAsLocalDate,
  localDateToKey,
  startOfDayInZone,
  timezoneLabel,
} from "@/lib/timezone";

const NAIROBI = "Africa/Nairobi"; // UTC+3, no DST
const ANTANANARIVO = "Indian/Antananarivo"; // UTC+3, no DST
const NEW_YORK = "America/New_York"; // UTC-5/-4, DST

describe("dateKeyInZone", () => {
  it("puts the same instant on different days in different zones", () => {
    const lateEvening = "2026-01-05T22:30:00.000Z";

    expect(dateKeyInZone(lateEvening, NAIROBI)).toBe("2026-01-06");
    expect(dateKeyInZone(lateEvening, NEW_YORK)).toBe("2026-01-05");
  });

  it("reads midnight as the day that is starting, not the one ending", () => {
    // 00:30 in Nairobi on the 6th is 21:30 UTC on the 5th.
    expect(dateKeyInZone("2026-01-05T21:30:00.000Z", NAIROBI)).toBe("2026-01-06");
  });
});

describe("startOfDayInZone", () => {
  it("finds midnight in a zone ahead of UTC", () => {
    expect(startOfDayInZone("2026-01-06", NAIROBI).toISOString()).toBe(
      "2026-01-05T21:00:00.000Z",
    );
  });

  it("finds midnight in a zone behind UTC", () => {
    expect(startOfDayInZone("2026-01-06", NEW_YORK).toISOString()).toBe(
      "2026-01-06T05:00:00.000Z",
    );
  });

  // The days a naive implementation lands an hour out.
  it("is correct on the day the clocks go forward", () => {
    // US DST begins 2026-03-08; that day starts at 05:00Z, still on EST.
    expect(startOfDayInZone("2026-03-08", NEW_YORK).toISOString()).toBe(
      "2026-03-08T05:00:00.000Z",
    );
  });

  it("is correct on the day after the clocks go forward", () => {
    // Now on EDT, so midnight is 04:00Z rather than 05:00Z.
    expect(startOfDayInZone("2026-03-09", NEW_YORK).toISOString()).toBe(
      "2026-03-09T04:00:00.000Z",
    );
  });

  it("is correct on the day the clocks go back", () => {
    // US DST ends 2026-11-01; that day starts at 04:00Z, still on EDT.
    expect(startOfDayInZone("2026-11-01", NEW_YORK).toISOString()).toBe(
      "2026-11-01T04:00:00.000Z",
    );
  });

  it("round-trips: the start of a day reads back as that day", () => {
    for (const dateKey of ["2026-03-08", "2026-03-09", "2026-11-01", "2026-06-15"]) {
      expect(dateKeyInZone(startOfDayInZone(dateKey, NEW_YORK), NEW_YORK)).toBe(
        dateKey,
      );
    }
  });
});

describe("endOfDayInZone", () => {
  it("is the start of the following day", () => {
    expect(endOfDayInZone("2026-01-05", NAIROBI).toISOString()).toBe(
      startOfDayInZone("2026-01-06", NAIROBI).toISOString(),
    );
  });

  // 23 hours long, not 24 — the reason day length can't be assumed.
  it("is 23 hours after the start on the day the clocks go forward", () => {
    const start = startOfDayInZone("2026-03-08", NEW_YORK).getTime();
    const end = endOfDayInZone("2026-03-08", NEW_YORK).getTime();

    expect((end - start) / 3_600_000).toBe(23);
  });

  it("is 25 hours long on the day the clocks go back", () => {
    const start = startOfDayInZone("2026-11-01", NEW_YORK).getTime();
    const end = endOfDayInZone("2026-11-01", NEW_YORK).getTime();

    expect((end - start) / 3_600_000).toBe(25);
  });
});

describe("formatTimeInZone", () => {
  it("shows the wall-clock time of that zone, not the viewer's", () => {
    const instant = "2026-01-05T09:00:00.000Z";

    expect(formatTimeInZone(instant, NAIROBI)).toContain("12:00");
    expect(formatTimeInZone(instant, NEW_YORK)).toContain("4:00");
  });
});

describe("timezoneAbbreviation", () => {
  const WINTER = new Date("2026-01-05T00:00:00Z");

  // ICU answers "GMT+3" for most of the world; the initials of its long
  // name ("East Africa Time") are the abbreviation people actually use.
  it("derives the abbreviation where ICU only offers a GMT offset", () => {
    expect(timezoneAbbreviation(NAIROBI, WINTER)).toBe("EAT");
    expect(timezoneAbbreviation(ANTANANARIVO, WINTER)).toBe("EAT");
    expect(timezoneAbbreviation("Asia/Tokyo", WINTER)).toBe("JST");
    expect(timezoneAbbreviation("Asia/Kolkata", WINTER)).toBe("IST");
  });

  it("keeps ICU's own abbreviation where it has a real one", () => {
    expect(timezoneAbbreviation(NEW_YORK, WINTER)).toBe("EST");
    expect(timezoneAbbreviation("Europe/London", WINTER)).toBe("GMT");
    expect(timezoneAbbreviation("UTC", WINTER)).toBe("UTC");
  });

  it("follows the season, not the zone alone", () => {
    expect(timezoneAbbreviation(NEW_YORK, new Date("2026-07-05T00:00:00Z"))).toBe(
      "EDT",
    );
  });
});

describe("timezoneLabel", () => {
  it("reads the area and city rather than the lookup key", () => {
    expect(timezoneLabel(ANTANANARIVO)).toBe("Indian - Antananarivo");
  });

  it("spaces out multi-word cities", () => {
    expect(timezoneLabel("America/New_York")).toBe("America - New York");
  });
});

describe("describeTimezone", () => {
  it("leads with the abbreviation, then the area and city", () => {
    expect(describeTimezone(NAIROBI, new Date("2026-01-05T00:00:00Z"))).toBe(
      "EAT: Africa - Nairobi",
    );
  });

  // Same zone, different abbreviation depending on the time of year.
  it("uses the abbreviation in force on the given date", () => {
    const winter = describeTimezone(NEW_YORK, new Date("2026-01-05T00:00:00Z"));
    const summer = describeTimezone(NEW_YORK, new Date("2026-07-05T00:00:00Z"));

    expect(winter).toContain("EST");
    expect(summer).toContain("EDT");
  });
});

describe("keyAsLocalDate and localDateToKey", () => {
  it("round-trips a key through the local Date a calendar lays out in", () => {
    expect(localDateToKey(keyAsLocalDate("2026-03-08"))).toBe("2026-03-08");
    expect(localDateToKey(keyAsLocalDate("2026-12-31"))).toBe("2026-12-31");
  });

  it("keeps the day the key names, whatever the runtime's offset", () => {
    const day = keyAsLocalDate("2026-01-05");

    expect(day.getFullYear()).toBe(2026);
    expect(day.getMonth()).toBe(0);
    expect(day.getDate()).toBe(5);
  });
});

describe("asZonedWallClock", () => {
  // Layout only: the local clock is made to read what the chosen zone
  // does, so a library positioning by local time lands it right.
  it("shifts an instant so its local clock matches the chosen zone's", () => {
    const instant = new Date("2026-01-05T09:00:00.000Z");
    const shifted = asZonedWallClock(instant, "Africa/Nairobi");

    // 09:00Z is 12:00 in Nairobi, so the shifted Date reads 12:00 locally.
    expect(shifted.getHours()).toBe(12);
    expect(shifted.getMinutes()).toBe(0);
  });

  it("is a no-op when the chosen zone is the runtime's own", () => {
    const instant = new Date("2026-01-05T09:00:00.000Z");
    const local = Intl.DateTimeFormat().resolvedOptions().timeZone;

    expect(asZonedWallClock(instant, local).getTime()).toBe(instant.getTime());
  });
});
