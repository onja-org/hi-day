import { describe, expect, it } from "vitest";
import { recoveryCodesFile } from "@/lib/recoveryCodesFile";

describe("recoveryCodesFile", () => {
  it("names the account and lists every code on its own line", () => {
    const text = recoveryCodesFile(["AAAAA-BBBBB", "CCCCC-DDDDD"], "jane@acme.test");
    const lines = text.split("\n");

    expect(lines[0]).toBe("Hi Day recovery codes for jane@acme.test");
    expect(lines).toContain("AAAAA-BBBBB");
    expect(lines).toContain("CCCCC-DDDDD");
    expect(text.endsWith("\n")).toBe(true);
  });
});
