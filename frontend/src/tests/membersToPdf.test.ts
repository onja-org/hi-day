import { describe, expect, it } from "vitest";
import { membersToPdf } from "@/lib/membersToPdf";

describe("membersToPdf", () => {
  it("renders an empty member list as a PDF", () => {
    expect(membersToPdf([], new Map()).type).toBe("application/pdf");
  });
});
