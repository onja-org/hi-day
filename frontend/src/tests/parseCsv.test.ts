import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/parseCsv";

describe("parseCsv", () => {
  it("splits rows and fields", () => {
    expect(parseCsv("email,role\na@x.com,member")).toEqual([
      ["email", "role"],
      ["a@x.com", "member"],
    ]);
  });

  it("handles quoted fields with commas, newlines and escaped quotes", () => {
    expect(parseCsv('name,note\n"Lovelace, Ada","said ""hi""\nthen left"')).toEqual([
      ["name", "note"],
      ["Lovelace, Ada", 'said "hi"\nthen left'],
    ]);
  });

  it("accepts CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("drops a leading byte-order mark", () => {
    expect(parseCsv("﻿email\na@x.com")).toEqual([["email"], ["a@x.com"]]);
  });

  it("skips blank rows, including ones that are only commas", () => {
    expect(parseCsv("email\n\n,,\na@x.com\n\n")).toEqual([["email"], ["a@x.com"]]);
  });

  it("keeps empty fields inside a row", () => {
    expect(parseCsv("a,,c")).toEqual([["a", "", "c"]]);
  });

  it("returns no rows for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });
});
