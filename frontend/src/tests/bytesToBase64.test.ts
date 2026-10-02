import { describe, expect, it } from "vitest";
import { bytesToBase64 } from "@/lib/bytesToBase64";

describe("bytesToBase64", () => {
  it("encodes ASCII bytes", () => {
    expect(bytesToBase64(new TextEncoder().encode("a,b"))).toBe("YSxi");
  });

  it("encodes non-ASCII text as UTF-8", () => {
    expect(bytesToBase64(new TextEncoder().encode("é"))).toBe("w6k=");
  });

  it("handles empty input", () => {
    expect(bytesToBase64(new Uint8Array())).toBe("");
  });

  it("handles input larger than one chunk", () => {
    const bytes = new Uint8Array(0x8000 * 2 + 5).fill(65);
    expect(atob(bytesToBase64(bytes))).toBe("A".repeat(bytes.length));
  });
});
