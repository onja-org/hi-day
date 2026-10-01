import { describe, expect, it } from "vitest";
import { findInvalidEmails } from "@/lib/findInvalidEmails";

describe("findInvalidEmails", () => {
  it("accepts ordinary addresses", () => {
    expect(findInvalidEmails(["a@b.co", "first.last+tag@sub.example.org"])).toEqual([]);
  });

  it("flags a missing @, a missing domain dot and whitespace", () => {
    expect(findInvalidEmails(["nope", "a@b", "a b@c.com"])).toEqual(["nope", "a@b", "a b@c.com"]);
  });

  it("returns nothing for an empty list", () => {
    expect(findInvalidEmails([])).toEqual([]);
  });
});
