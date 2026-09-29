import { describe, expect, it } from "vitest";
import { buildInviteLinkUrl } from "@/lib/buildInviteLinkUrl";

describe("buildInviteLinkUrl", () => {
  it("builds the join URL on the given origin", () => {
    expect(buildInviteLinkUrl("https://app.example.com", "abc")).toBe(
      "https://app.example.com/join?token=abc",
    );
  });

  it("tolerates a trailing slash and encodes the token", () => {
    expect(buildInviteLinkUrl("http://localhost:3000/", "a+b")).toBe(
      "http://localhost:3000/join?token=a%2Bb",
    );
  });
});
