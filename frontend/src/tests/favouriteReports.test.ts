import { describe, expect, it } from "vitest";
import {
  parseFavouriteReportIds,
  toggleFavouriteReportId,
} from "@/lib/favouriteReports";

describe("parseFavouriteReportIds", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(parseFavouriteReportIds(null)).toEqual([]);
  });

  it("returns the stored ids", () => {
    expect(parseFavouriteReportIds('["a","b"]')).toEqual(["a", "b"]);
  });

  it("returns an empty list for malformed JSON", () => {
    expect(parseFavouriteReportIds("{nope")).toEqual([]);
  });

  it("returns an empty list when the JSON isn't an array", () => {
    expect(parseFavouriteReportIds('{"a":1}')).toEqual([]);
  });

  it("drops entries that aren't strings", () => {
    expect(parseFavouriteReportIds('["a",1,null]')).toEqual(["a"]);
  });
});

describe("toggleFavouriteReportId", () => {
  it("appends an id that isn't a favourite yet", () => {
    expect(toggleFavouriteReportId(["a"], "b")).toEqual(["a", "b"]);
  });

  it("removes an id that already is a favourite", () => {
    expect(toggleFavouriteReportId(["a", "b"], "a")).toEqual(["b"]);
  });
});
