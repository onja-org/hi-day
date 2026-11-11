import { describe, expect, it } from "vitest";
import { previewRangeCut } from "@/lib/previewRangeCut";

const at = (hhmm: string) => `2026-01-05T${hhmm}:00.000Z`;
const entry = { startedAt: at("09:00"), endedAt: at("17:00"), pauses: [] };

describe("previewRangeCut", () => {
  it("removes the range and keeps the time either side", () => {
    const preview = previewRangeCut(entry, at("12:00"), at("13:00"), "remove");

    expect(preview).toEqual({
      ok: true,
      from: at("12:00"),
      to: at("13:00"),
      pieces: [
        { startedAt: at("09:00"), endedAt: at("12:00"), seconds: 3 * 3600, removed: false },
        { startedAt: at("12:00"), endedAt: at("13:00"), seconds: 3600, removed: true },
        { startedAt: at("13:00"), endedAt: at("17:00"), seconds: 4 * 3600, removed: false },
      ],
    });
  });

  it("keeps the range as its own entry when splitting", () => {
    const preview = previewRangeCut(entry, at("12:00"), at("13:00"), "split");

    expect(preview.ok && preview.pieces.map((piece) => piece.removed)).toEqual([
      false,
      false,
      false,
    ]);
  });

  it("leaves no piece on a side the range touches", () => {
    const preview = previewRangeCut(entry, at("09:00"), at("10:00"), "remove");

    expect(preview.ok && preview.pieces.map((piece) => piece.startedAt)).toEqual([
      at("09:00"),
      at("10:00"),
    ]);
    expect(preview.ok && preview.pieces[0].removed).toBe(true);
  });

  it("reads a time within a minute of the entry's end as the end itself", () => {
    const withSeconds = { ...entry, endedAt: "2026-01-05T17:00:42.000Z" };

    const preview = previewRangeCut(withSeconds, at("16:00"), at("17:00"), "remove");

    expect(preview.ok && preview.to).toBe("2026-01-05T17:00:42.000Z");
    expect(preview.ok && preview.pieces).toHaveLength(2);
  });

  it("subtracts the pauses that fall inside each piece", () => {
    const paused = {
      ...entry,
      pauses: [{ pausedAt: at("11:30"), resumedAt: at("12:30") }],
    };

    const preview = previewRangeCut(paused, at("12:00"), at("13:00"), "split");

    expect(preview.ok && preview.pieces.map((piece) => piece.seconds)).toEqual([
      3 * 3600 - 1800,
      3600 - 1800,
      4 * 3600,
    ]);
  });

  it.each([
    ["covers the whole entry", at("09:00"), at("17:00"), "whole entry"],
    ["falls outside the entry", at("08:00"), at("10:00"), "between the start and end"],
    ["ends before it starts", at("13:00"), at("12:00"), "end after it starts"],
    ["is incomplete", "", at("12:00"), "Enter both times"],
  ])("refuses a range that %s", (_case, from, to, message) => {
    const preview = previewRangeCut(entry, from, to, "remove");

    expect(preview.ok).toBe(false);
    expect(!preview.ok && preview.message).toContain(message);
  });
});
