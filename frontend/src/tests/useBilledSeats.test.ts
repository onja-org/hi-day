import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useQuery = vi.fn().mockReturnValue({ data: undefined });
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => useQuery(options) as unknown,
}));

const useCurrentOrganisation = vi.fn();
vi.mock("@/hooks/useCurrentOrganisation", () => ({
  useCurrentOrganisation: () => useCurrentOrganisation() as unknown,
}));

const useBillingEnabled = vi.fn();
vi.mock("@/hooks/useBillingEnabled", () => ({
  useBillingEnabled: () => useBillingEnabled() as boolean,
}));

const { useBilledSeats } = await import("@/hooks/useBilledSeats");

/** The `enabled` option the query actually ran with. */
function enabledFlag(): boolean {
  return (useQuery.mock.calls.at(-1)?.[0] as { enabled: boolean }).enabled;
}

beforeEach(() => {
  useCurrentOrganisation.mockReturnValue({ data: { role: "admin" } });
  useBillingEnabled.mockReturnValue(true);
});

afterEach(() => {
  useQuery.mockClear();
  useCurrentOrganisation.mockReset();
  useBillingEnabled.mockReset();
});

describe("asking the backend what it bills for", () => {
  /** The route is not registered when billing is off, so the call could
   * only 404. */
  it("is not asked at all with billing off", () => {
    useBillingEnabled.mockReturnValue(false);

    renderHook(() => useBilledSeats("org-1"));

    expect(enabledFlag()).toBe(false);
  });

  it("is asked for an admin with billing on", () => {
    renderHook(() => useBilledSeats("org-1"));

    expect(enabledFlag()).toBe(true);
  });

  // Admin-only stands whatever the flag says: the endpoint refuses anyone
  // else, so asking would only earn a 403.
  it("is not asked for a member, billing on or not", () => {
    useCurrentOrganisation.mockReturnValue({ data: { role: "member" } });

    renderHook(() => useBilledSeats("org-1"));

    expect(enabledFlag()).toBe(false);
  });
});
