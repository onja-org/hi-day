import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const previewSeatChange = vi.fn();
vi.mock("@/lib/subscriptionApi", () => ({
  previewSeatChange: (...args: unknown[]) =>
    previewSeatChange(...args) as unknown,
}));

const { SeatChangeConfirm } = await import(
  "@/components/settings/SeatChangeConfirm"
);

const PREVIEW = {
  seats: 54,
  proratedNowMinor: 14_000,
  nextPaymentMinor: 226_800,
  currentNextPaymentMinor: 210_000,
  currency: "usd",
  chargedAt: "2026-11-29T09:00:00.000Z",
};

function renderPanel(plan: "annual" | "monthly" = "annual", props = {}) {
  return render(
    <SeatChangeConfirm
      organisationId={100000}
      seats={54}
      plan={plan}
      confirming={false}
      onCancel={vi.fn()}
      onConfirm={vi.fn()}
      {...props}
    />,
  );
}

beforeEach(() => {
  previewSeatChange.mockReset();
  previewSeatChange.mockResolvedValue({ ok: true, data: PREVIEW });
});

describe("the figures", () => {
  // Stripe's own preview, never our arithmetic: a total of ours that
  // disagreed with the invoice would be worse than showing none.
  it("asks Stripe and shows what it answers", async () => {
    renderPanel();

    expect(previewSeatChange).toHaveBeenCalledWith(100000, 54);
    expect(await screen.findByText("$140.00")).toBeInTheDocument();
    expect(screen.getByText("$2,100.00 → $2,268.00")).toBeInTheDocument();
  });

  it("says it is still asking before the answer lands", () => {
    renderPanel();
    expect(screen.getByText(/Asking Stripe what this costs/)).toBeInTheDocument();
  });

  // A monthly change prorates nothing, and a $0.00 line invites the question
  // of why it is there.
  it("shows no charge-now line when there is nothing to take now", async () => {
    previewSeatChange.mockResolvedValue({
      ok: true,
      data: { ...PREVIEW, proratedNowMinor: 0 },
    });

    renderPanel("monthly");

    expect(await screen.findByText("Next payment")).toBeInTheDocument();
    expect(screen.queryByText(/Charged on/)).not.toBeInTheDocument();
  });

  it("says so when Stripe cannot be asked", async () => {
    previewSeatChange.mockResolvedValue({ ok: false, message: "Stripe is down." });

    renderPanel();

    expect(await screen.findByText("Stripe is down.")).toBeInTheDocument();
  });
});

describe("confirming", () => {
  // Agreeing before Stripe has answered would be agreeing to a figure nobody
  // has seen.
  it("will not confirm until the figures are in and the box is ticked", async () => {
    const onConfirm = vi.fn();
    renderPanel("annual", { onConfirm });

    const confirm = screen.getByRole("button", { name: "Confirm 54 seats" });
    expect(confirm).toBeDisabled();

    await screen.findByText("$140.00");
    expect(confirm).toBeDisabled();

    fireEvent.click(screen.getByLabelText("I understand my bill will change."));
    expect(confirm).toBeEnabled();

    fireEvent.click(confirm);
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
  });

  it("offers a way out that changes nothing", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    renderPanel("annual", { onCancel, onConfirm });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
