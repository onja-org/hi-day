import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BilledSeats } from "@/types/billing";

const useBilledSeats = vi.fn();
const acknowledgeSeatOverage = vi.fn();
vi.mock("@/lib/setBilledSeats", () => ({
  acknowledgeSeatOverage: (...args: unknown[]) =>
    acknowledgeSeatOverage(...args) as unknown,
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  }),
  useMutation: ({
    mutationFn,
    onSuccess,
  }: {
    mutationFn: () => Promise<unknown>;
    onSuccess: (result: unknown) => void;
  }) => ({
    isPending: false,
    mutate: () => void mutationFn().then(onSuccess),
  }),
}));
vi.mock("@/hooks/useBilledSeats", () => ({
  useBilledSeats: (organisationId: number | string) =>
    useBilledSeats(organisationId) as unknown,
  billedSeatsQueryKey: (organisationId: number | string) => [
    "billing",
    "seats",
    String(organisationId),
  ],
}));

const { SeatsExceededBanner } = await import(
  "@/components/SeatsExceededBanner"
);

function seats(overrides: Partial<BilledSeats>): BilledSeats {
  return {
    count: 10,
    memberCount: 10,
    purchasedSeats: 10,
    isOverPurchasedSeats: false,
    needsOverageAcknowledgement: false,
    ...overrides,
  };
}

function renderWith(data: BilledSeats | undefined) {
  useBilledSeats.mockReturnValue({ data });
  return render(<SeatsExceededBanner organisationId={100000} />);
}

beforeEach(() => {
  acknowledgeSeatOverage.mockReset();
  acknowledgeSeatOverage.mockResolvedValue({ ok: true, seats: {}, message: "ok" });
});

describe("SeatsExceededBanner", () => {
  it("names the seats bought once the members outnumber them", () => {
    renderWith(
      seats({
        memberCount: 12,
        purchasedSeats: 10,
        isOverPurchasedSeats: true,
        needsOverageAcknowledgement: true,
      }),
    );

    // Matched on the rendered sentence rather than one element: the title
    // and the rest sit in separate nodes, and what matters is what reads.
    expect(screen.getByRole("status").textContent).toContain(
      "You only purchased 10 seats. If you keep adding new members, it will affect your billing on the next payment.",
    );
  });

  it("says nothing while the team fits the seats", () => {
    renderWith(
      seats({ memberCount: 10, purchasedSeats: 10, isOverPurchasedSeats: false }),
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  // Nothing was promised, so nothing is exceeded — every trial is here.
  it("says nothing where no seats were ever bought", () => {
    renderWith(
      seats({ memberCount: 40, purchasedSeats: null, isOverPurchasedSeats: false }),
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  // The hook makes no request for a manager or member, so there is no data
  // and no banner — a non-admin is never told about the bill.
  it("says nothing for anyone the seats endpoint refuses", () => {
    renderWith(undefined);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  /**
   * Was "offers no way to dismiss it" — it is a consent now, so there is an
   * acknowledgement. What has not changed is that it cannot be waved away:
   * the button stays disabled until the box is ticked, so a stray click
   * cannot stand in for reading it.
   */
  it("will not record an acknowledgement until the box is ticked", async () => {
    renderWith(
      seats({
        memberCount: 12,
        purchasedSeats: 10,
        isOverPurchasedSeats: true,
        needsOverageAcknowledgement: true,
      }),
    );

    const confirm = screen.getByRole("button", { name: "Got it" });
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(acknowledgeSeatOverage).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByLabelText("I understand my bill will change."),
    );
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(acknowledgeSeatOverage).toHaveBeenCalledWith(100000),
    );
  });

  // Over the seats, but somebody has already said they understand — the
  // notice has done its job and stops repeating.
  it("says nothing once it has been acknowledged at this size", () => {
    renderWith(
      seats({
        memberCount: 12,
        purchasedSeats: 10,
        isOverPurchasedSeats: true,
        needsOverageAcknowledgement: false,
      }),
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("says seat, not seats, for a single one", () => {
    renderWith(
      seats({
        memberCount: 3,
        purchasedSeats: 1,
        isOverPurchasedSeats: true,
        needsOverageAcknowledgement: true,
      }),
    );

    expect(screen.getByRole("status").textContent).toContain(
      "You only purchased 1 seat.",
    );
  });
});
