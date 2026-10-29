import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sendContactMessage = vi.fn();
vi.mock("@/lib/sendContactMessage", () => ({
  sendContactMessage: (...args: unknown[]) =>
    sendContactMessage(...args) as unknown,
}));

const { ContactModal } = await import("@/components/ContactModal");

const VALID = {
  email: "someone@acme.test",
  website: "acme.com",
  message: "We are forty people and want to talk about seats.",
};

function fill(overrides: Partial<typeof VALID> & { phone?: string } = {}) {
  const values = { ...VALID, ...overrides };
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: values.email },
  });
  fireEvent.change(screen.getByLabelText("Website URL"), {
    target: { value: values.website },
  });
  if (overrides.phone !== undefined) {
    fireEvent.change(screen.getByLabelText(/Phone number/), {
      target: { value: overrides.phone },
    });
  }
  fireEvent.change(screen.getByLabelText("Message"), {
    target: { value: values.message },
  });
}

function send() {
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
}

beforeEach(() => {
  sendContactMessage.mockReset();
  sendContactMessage.mockResolvedValue({ ok: true });
});

describe("the form", () => {
  it("shows the title, subtitle and the optional marker", () => {
    render(<ContactModal onClose={vi.fn()} />);

    expect(screen.getByText("Talk to us")).toBeInTheDocument();
    expect(
      screen.getByText(/Have a question, idea, or feedback\?/),
    ).toBeInTheDocument();
    expect(screen.getByText("(optional)")).toBeInTheDocument();
  });

  it("counts the characters left in the message, live", () => {
    render(<ContactModal onClose={vi.fn()} />);
    expect(screen.getByText("2000 characters left")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "hello" },
    });
    expect(screen.getByText("1995 characters left")).toBeInTheDocument();
  });
});

describe("validation", () => {
  // Quiet until a field has been left: showing "enter your email" after the
  // first keystroke is telling somebody off mid-sentence.
  it("says nothing until a field is blurred", () => {
    render(<ContactModal onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "nope" },
    });
    expect(screen.queryByText("Enter a valid email address.")).not.toBeInTheDocument();

    fireEvent.blur(screen.getByLabelText("Email address"));
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
  });

  it("reports every bad field on submit, and sends nothing", () => {
    render(<ContactModal onClose={vi.fn()} />);

    send();

    expect(screen.getByText("Enter your email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your website.")).toBeInTheDocument();
    expect(screen.getByText(/at least 10 characters/)).toBeInTheDocument();
    expect(sendContactMessage).not.toHaveBeenCalled();
  });

  // The whole point of normalising: a person types what they say out loud.
  it("accepts a website with no protocol", async () => {
    render(<ContactModal onClose={vi.fn()} />);

    fill();
    send();

    await waitFor(() => expect(sendContactMessage).toHaveBeenCalled());
  });

  it("refuses a phone that is not a phone, but allows it being empty", async () => {
    render(<ContactModal onClose={vi.fn()} />);

    fill({ phone: "call me" });
    send();
    expect(screen.getByText(/digits, spaces/)).toBeInTheDocument();
    expect(sendContactMessage).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Phone number/), {
      target: { value: "" },
    });
    send();
    await waitFor(() => expect(sendContactMessage).toHaveBeenCalled());
  });

  it("clears an error as soon as it stops being true", () => {
    render(<ContactModal onClose={vi.fn()} />);

    fireEvent.blur(screen.getByLabelText("Email address"));
    expect(screen.getByText("Enter your email address.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "someone@acme.test" },
    });
    expect(
      screen.queryByText("Enter your email address."),
    ).not.toBeInTheDocument();
  });
});

describe("sending", () => {
  it("disables the button and says so while in flight", async () => {
    let resolve: (value: unknown) => void = () => {};
    sendContactMessage.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );

    render(<ContactModal onClose={vi.fn()} />);
    fill();
    send();

    const button = await screen.findByRole("button", { name: /Sending/ });
    expect(button).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    resolve({ ok: true });
  });

  it("replaces the form with a confirmation naming the address", async () => {
    render(<ContactModal onClose={vi.fn()} />);
    fill();
    send();

    expect(
      await screen.findByText(/Thanks! Your message has been sent/),
    ).toBeInTheDocument();
    expect(screen.getByText("someone@acme.test")).toBeInTheDocument();
    expect(screen.queryByLabelText("Message")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });
});

describe("when it fails", () => {
  // Re-typing a message because a request failed is the worst part of a form
  // like this.
  it("shows the banner and keeps every word they typed", async () => {
    sendContactMessage.mockResolvedValue({
      ok: false,
      message: "Something went wrong. Please try again.",
    });

    render(<ContactModal onClose={vi.fn()} />);
    fill();
    send();

    expect(
      await screen.findByText("Something went wrong. Please try again."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toHaveValue(VALID.message);
    expect(screen.getByLabelText("Email address")).toHaveValue(VALID.email);
  });

  // The server's own field errors land under the right inputs.
  it("puts a server field error under its field", async () => {
    sendContactMessage.mockResolvedValue({
      ok: false,
      errors: { email: "That address bounced." },
    });

    render(<ContactModal onClose={vi.fn()} />);
    fill();
    send();

    expect(await screen.findByText("That address bounced.")).toBeInTheDocument();
  });
});

describe("the honeypot", () => {
  // Hidden from sight and from assistive tech, so nobody is ever asked to
  // fill it — and anything in it is a bot.
  it("is present, off-screen and not reachable by Tab", () => {
    render(<ContactModal onClose={vi.fn()} />);

    const honeypot = screen.getByLabelText("Company (leave this empty)");
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("is sent along so the server can judge it", async () => {
    render(<ContactModal onClose={vi.fn()} />);
    fill();
    send();

    await waitFor(() =>
      expect(sendContactMessage).toHaveBeenCalledWith(
        expect.objectContaining({ company: "" }),
      ),
    );
  });
});
