import { beforeEach, describe, expect, it, vi } from "vitest";

describe("resetEmailSentNotice", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("is not set before markResetEmailSent has been called", async () => {
    const { consumeResetEmailSent } =
      await import("@/lib/resetEmailSentNotice");

    expect(consumeResetEmailSent()).toBe(false);
  });

  it("returns true exactly once after markResetEmailSent, then false again", async () => {
    const { markResetEmailSent, consumeResetEmailSent } =
      await import("@/lib/resetEmailSentNotice");

    markResetEmailSent();

    expect(consumeResetEmailSent()).toBe(true);
    expect(consumeResetEmailSent()).toBe(false);
  });
});
