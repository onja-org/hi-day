import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const createSubscriptionIntent = vi.fn();
const confirmCardPayment = vi.fn();
const getElement = vi.fn(() => ({}));

vi.mock("@/lib/createSubscriptionIntent", () => ({
  createSubscriptionIntent: (...args: unknown[]) =>
    createSubscriptionIntent(...args) as unknown,
}));
vi.mock("@/lib/stripeClient", () => ({
  getStripe: () => Promise.resolve(null),
  hasStripeKey: () => true,
}));
vi.mock("@/hooks/useBilledSeats", () => ({
  useBilledSeats: () => ({ data: { purchasedSeats: 3, memberCount: 3 } }),
  billedSeatsQueryKey: () => ["billing", "seats"],
}));
vi.mock("@/hooks/useCurrentOrganisation", () => ({
  useCurrentOrganisation: () => ({ data: { billingEmail: "ap@acme.test" } }),
}));
vi.mock("@/hooks/useTrialStatus", () => ({
  trialStatusQueryKey: () => ["billing", "trial"],
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

// The card fields are Stripe-owned iframes; only their presence matters here.
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  CardNumberElement: () => <div data-testid="card-number" />,
  CardExpiryElement: () => <div data-testid="card-expiry" />,
  CardCvcElement: () => <div data-testid="card-cvc" />,
  useStripe: () => ({ confirmCardPayment }),
  useElements: () => ({ getElement }),
}));

const { PaymentModal } = await import("@/components/billing/PaymentModal");

beforeEach(() => {
  createSubscriptionIntent.mockReset();
  confirmCardPayment.mockReset();
});

describe("the summary shows only the cycle that was chosen", () => {
  it("shows the annual sum, its monthly equivalent, and no monthly rival", () => {
    render(
      <PaymentModal
        organisationId={100000}
        period="annual"
        seats={6}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/6 seats × \$3\.50 × 12 months/)).toBeInTheDocument();
    expect(screen.getByText("That works out to")).toBeInTheDocument();
    expect(screen.getByText("$21.00 / month")).toBeInTheDocument();
    // The monthly cycle's own total ($24.00) must not appear at all.
    expect(screen.queryByText("$24.00")).not.toBeInTheDocument();
  });

  it("shows the monthly sum and nothing annual", () => {
    render(
      <PaymentModal
        organisationId={100000}
        period="monthly"
        seats={6}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/6 seats × \$4\.00 per month/)).toBeInTheDocument();
    expect(screen.queryByText("$252.00")).not.toBeInTheDocument();
    expect(screen.queryByText("That works out to")).not.toBeInTheDocument();
  });

  // The choice was made on the Billing page; repeating the comparison here
  // only invites the two to disagree.
  it("says nothing about the cycle that was not chosen", () => {
    const { container } = render(
      <PaymentModal
        organisationId={100000}
        period="annual"
        seats={6}
        onClose={vi.fn()}
      />,
    );

    expect(container.textContent).not.toMatch(/Save ~/);
    expect(container.textContent).not.toMatch(/cancel anytime/i);
  });

  // Paying ends the trial that day, so there is no trial-end date to show.
  it("shows what is charged today and the next renewal, not a trial date", () => {
    const { container } = render(
      <PaymentModal
        organisationId={100000}
        period="annual"
        seats={6}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Charged today")).toBeInTheDocument();
    expect(screen.getByText("Next payment")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/trial/i);
    expect(container.textContent).not.toMatch(/Due today/);
  });
});

describe("no way to change the cycle inside the modal", () => {
  it("renders no radios and no switches", () => {
    render(
      <PaymentModal
        organisationId={100000}
        period="annual"
        seats={6}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.queryAllByRole("radiogroup")).toHaveLength(0);
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
  });

  it("keeps the card fields, the Stripe note and both buttons", () => {
    render(
      <PaymentModal
        organisationId={100000}
        period="annual"
        seats={6}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Cardholder name")).toBeInTheDocument();
    expect(screen.getByTestId("card-number")).toBeInTheDocument();
    expect(screen.getByTestId("card-expiry")).toBeInTheDocument();
    expect(screen.getByTestId("card-cvc")).toBeInTheDocument();
    expect(screen.getByText(/processed securely by Stripe/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirm payment" }),
    ).toBeInTheDocument();
  });
});

describe("what confirm sends", () => {
  it("sends the cycle and seat count the modal displayed", async () => {
    createSubscriptionIntent.mockResolvedValue({
      ok: true,
      intent: { clientSecret: "cs_1", nextPaymentAt: "2027-10-29T00:00:00.000Z" },
    });
    confirmCardPayment.mockResolvedValue({ error: undefined });

    render(
      <PaymentModal
        organisationId={100000}
        period="monthly"
        seats={9}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Cardholder name"), {
      target: { value: "A Payer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm payment" }));

    await waitFor(() =>
      expect(createSubscriptionIntent).toHaveBeenCalledWith(
        100000,
        "monthly",
        9,
      ),
    );
  });
});

describe("opened without a selection", () => {
  // The trial banner appears on every page and has no toggle to read.
  it("falls back to annual and the seats on record", () => {
    render(<PaymentModal organisationId={100000} onClose={vi.fn()} />);

    expect(screen.getByText(/Billed annually · 3 seats/)).toBeInTheDocument();
    expect(screen.getByText(/3 seats × \$3\.50 × 12 months/)).toBeInTheDocument();
  });
});
