import { describe, expect, it } from "vitest";
import {
  DEFAULT_PUBLIC_CONFIG,
  parsePublicConfig,
} from "@/lib/publicConfig";

/**
 * The two mistakes are not symmetric. Guessing "billing on" would show a
 * self-hoster a trial banner and a paywall for a product we told them was
 * free forever; guessing "off" hides a Billing link on Cloud until the
 * next request succeeds. So anything unclear reads as off.
 */
describe("what the backend said about billing", () => {
  it("is on only for a real boolean true", () => {
    expect(parsePublicConfig({ billingEnabled: true })).toEqual({
      billingEnabled: true,
    });
  });

  it("is off for false", () => {
    expect(parsePublicConfig({ billingEnabled: false })).toEqual({
      billingEnabled: false,
    });
  });

  // A truthy string is what a misconfigured proxy or a hand-rolled stub
  // sends; it is not the backend saying yes.
  it("is off for anything that merely looks true", () => {
    for (const value of ["true", 1, "yes", {}, []]) {
      expect(parsePublicConfig({ billingEnabled: value }).billingEnabled).toBe(
        false,
      );
    }
  });

  /**
   * An older backend with no /config yet, or a proxy's HTML error page.
   * Falling back beats throwing: every caller would otherwise need an
   * error state for a question the user never asked.
   */
  it("falls back for a response that is not an object", () => {
    for (const value of [null, undefined, "", "nope", 42]) {
      expect(parsePublicConfig(value)).toEqual(DEFAULT_PUBLIC_CONFIG);
    }
  });

  it("falls back for an object with no such field", () => {
    expect(parsePublicConfig({})).toEqual(DEFAULT_PUBLIC_CONFIG);
  });

  it("defaults to billing off", () => {
    expect(DEFAULT_PUBLIC_CONFIG).toEqual({ billingEnabled: false });
  });
});
