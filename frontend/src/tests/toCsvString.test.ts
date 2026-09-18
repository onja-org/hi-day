import { describe, expect, it } from "vitest";
import { toCsvString } from "@/lib/toCsvString";

describe("toCsvString", () => {
  it("writes a header row followed by one row per data row", () => {
    const csv = toCsvString(["A", "B"], [["1", "2"]]);
    expect(csv.split("\n")).toEqual(["A,B", "1,2"]);
  });

  it("quotes and escapes a field containing a comma", () => {
    const csv = toCsvString(["Name"], [["Acme, Inc."]]);
    expect(csv).toContain('"Acme, Inc."');
  });

  it("quotes and doubles an embedded quote character", () => {
    const csv = toCsvString(["Name"], [['Say "hi"']]);
    expect(csv).toContain('"Say ""hi"""');
  });

  it("quotes a field containing a newline", () => {
    const csv = toCsvString(["Note"], [["line one\nline two"]]);
    expect(csv).toContain('"line one\nline two"');
  });

  it("returns just the header row for no data rows", () => {
    expect(toCsvString(["A"], []).split("\n")).toEqual(["A"]);
  });
});
