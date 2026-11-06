import { describe, expect, it } from "vitest";
import { DEFAULT_PUBLIC_CONFIG, parsePublicConfig } from "@/lib/publicConfig";

/** Anything unclear reads as off: guessing "on" would show a self-hoster a
 * paywall, guessing "off" only hides a link on Cloud. */
describe("what the backend said about billing", () => {
  it("is on only for a real boolean true", () => {
    expect(parsePublicConfig({ billingEnabled: true })).toEqual({
      billingEnabled: true,
    });

    for (const value of [false, "true", 1, "yes", {}, []]) {
      expect(parsePublicConfig({ billingEnabled: value }).billingEnabled).toBe(
        false,
      );
    }
  });

  /** An older backend with no /config, or a proxy's HTML error page. */
  it("falls back for anything that is not a config object", () => {
    for (const value of [null, undefined, "", "nope", 42, {}]) {
      expect(parsePublicConfig(value)).toEqual(DEFAULT_PUBLIC_CONFIG);
    }
    expect(DEFAULT_PUBLIC_CONFIG).toEqual({ billingEnabled: false });
  });
});
