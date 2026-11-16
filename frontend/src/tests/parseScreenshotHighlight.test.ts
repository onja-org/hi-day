import { describe, expect, it } from "vitest";
import { parseScreenshotHighlight } from "@/lib/parseScreenshotHighlight";

const parse = (query: string) => parseScreenshotHighlight(new URLSearchParams(query));

describe("parseScreenshotHighlight", () => {
  it("reads both ends", () => {
    expect(parse("highlightFrom=2026-11-10T14:00:00.000Z&highlightTo=2026-11-10T16:00:00.000Z")).toEqual({
      from: "2026-11-10T14:00:00.000Z",
      to: "2026-11-10T16:00:00.000Z",
    });
  });

  it("ignores a missing, invalid or backwards stretch", () => {
    expect(parse("")).toBeNull();
    expect(parse("highlightFrom=2026-11-10T14:00:00.000Z")).toBeNull();
    expect(parse("highlightFrom=soon&highlightTo=2026-11-10T16:00:00.000Z")).toBeNull();
    expect(parse("highlightFrom=2026-11-10T16:00:00.000Z&highlightTo=2026-11-10T14:00:00.000Z")).toBeNull();
  });
});
