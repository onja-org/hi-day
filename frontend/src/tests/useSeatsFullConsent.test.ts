import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BilledSeats } from "@/types/billing";

const useBilledSeats = vi.fn();
vi.mock("@/hooks/useBilledSeats", () => ({
  useBilledSeats: () => useBilledSeats() as unknown,
  billedSeatsQueryKey: (organisationId: number | string) => [
    "billing",
    "seats",
    String(organisationId),
  ],
}));

const useBillingEnabled = vi.fn();
vi.mock("@/hooks/useBillingEnabled", () => ({
  useBillingEnabled: () => useBillingEnabled() as boolean,
}));

const { useSeatsFullConsent } = await import("@/hooks/useSeatsFullConsent");

/** Every purchased seat taken — the one state that asks for consent. */
function seatsFull(): { data: BilledSeats } {
  return {
    data: {
      count: 10,
      memberCount: 10,
      purchasedSeats: 10,
      isOverPurchasedSeats: false,
      seatsAreFull: true,
    } as BilledSeats,
  };
}

beforeEach(() => {
  useBilledSeats.mockReturnValue(seatsFull());
});

afterEach(() => {
  useBilledSeats.mockReset();
  useBillingEnabled.mockReset();
});

/** The only place billing state can hold back a submit button. */
describe("the seats-full consent with billing off", () => {
  beforeEach(() => useBillingEnabled.mockReturnValue(false));

  it("asks for nothing, even with every purchased seat taken", () => {
    const { result } = renderHook(() => useSeatsFullConsent("org-1"));

    expect(result.current.required).toBe(false);
  });

  // The whole point: no invite is ever held up on a free install.
  it("never blocks a submit", () => {
    const { result } = renderHook(() => useSeatsFullConsent("org-1"));

    expect(result.current.blocked).toBe(false);
  });

  /** Also the "still loading" and "backend unreachable" case. */
  it("asks for nothing before the flag has arrived", () => {
    const { result } = renderHook(() => useSeatsFullConsent("org-1"));

    expect(result.current.required).toBe(false);
  });
});

describe("the seats-full consent with billing on", () => {
  beforeEach(() => useBillingEnabled.mockReturnValue(true));

  it("asks for consent once every purchased seat is taken", () => {
    const { result } = renderHook(() => useSeatsFullConsent("org-1"));

    expect(result.current.required).toBe(true);
    expect(result.current.blocked).toBe(true);
  });

  it("asks for nothing while seats remain", () => {
    useBilledSeats.mockReturnValue({
      data: { ...seatsFull().data, memberCount: 4, seatsAreFull: false },
    });

    const { result } = renderHook(() => useSeatsFullConsent("org-1"));

    expect(result.current.required).toBe(false);
  });

  /** Admin-only figures never resolve for a manager, who must not be
   * blocked over a request they cannot make. */
  it("asks for nothing where the figures never arrive", () => {
    useBilledSeats.mockReturnValue({ data: undefined });

    const { result } = renderHook(() => useSeatsFullConsent("org-1"));

    expect(result.current.required).toBe(false);
    expect(result.current.blocked).toBe(false);
  });
});
