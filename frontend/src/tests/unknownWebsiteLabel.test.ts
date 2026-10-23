import { describe, expect, it } from "vitest";
import { unknownWebsiteLabel } from "@/lib/unknownWebsiteLabel";

describe("unknownWebsiteLabel", () => {
  it("names a known browser", () => {
    expect(unknownWebsiteLabel("chrome")).toBe("Unknown website (Chrome)");
    expect(unknownWebsiteLabel("firefox")).toBe("Unknown website (Firefox)");
  });

  it("leaves out a browser it has no name for", () => {
    expect(unknownWebsiteLabel("chromium-generic")).toBe("Unknown website");
  });
});
