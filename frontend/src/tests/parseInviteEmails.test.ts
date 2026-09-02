import { describe, expect, it } from "vitest";
import { parseInviteEmails } from "@/lib/parseInviteEmails";

describe("parseInviteEmails", () => {
  it("splits newline-separated emails", () => {
    expect(parseInviteEmails("a@b.test\nc@d.test\ne@f.test")).toEqual([
      "a@b.test",
      "c@d.test",
      "e@f.test",
    ]);
  });

  it("splits comma- and semicolon-separated emails", () => {
    expect(parseInviteEmails("a@b.test, c@d.test; e@f.test")).toEqual([
      "a@b.test",
      "c@d.test",
      "e@f.test",
    ]);
  });

  it("trims whitespace and drops empty entries", () => {
    expect(parseInviteEmails("  a@b.test  \n\n  \n c@d.test ")).toEqual([
      "a@b.test",
      "c@d.test",
    ]);
  });

  it("lowercases and de-duplicates entries", () => {
    expect(parseInviteEmails("A@B.test\na@b.test\nA@b.TEST")).toEqual([
      "a@b.test",
    ]);
  });

  it("returns an empty array for blank input", () => {
    expect(parseInviteEmails("   \n  ")).toEqual([]);
  });
});
