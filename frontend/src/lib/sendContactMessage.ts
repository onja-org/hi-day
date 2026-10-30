import { API_URL } from "./apiUrl";
import type { ContactFieldErrors, ContactMessageInput } from "./contactRules.generated";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export type SendContactResult =
  | { ok: true }
  /** Per-field messages, so each sits under the input it belongs to. */
  | { ok: false; errors: ContactFieldErrors }
  | { ok: false; message: string };

/**
 * Posts the message to the backend, which revalidates it and holds the
 * recipient address. The address never reaches the browser — that is the
 * reason this is a backend call rather than a mail client link.
 */
export async function sendContactMessage(
  input: ContactMessageInput,
): Promise<SendContactResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) return { ok: true };

  const data = (await response.json().catch(() => null)) as {
    errors?: ContactFieldErrors;
    message?: string | string[];
  } | null;

  // Field errors win over the banner: pointing at the input is more use than
  // saying something went wrong somewhere.
  if (data?.errors && Object.keys(data.errors).length > 0) {
    return { ok: false, errors: data.errors };
  }

  // 429 is the rate limiter, and deserves its own wording — "try again"
  // against a limit that lasts ten minutes is advice that fails twice.
  if (response.status === 429) {
    return {
      ok: false,
      message: "Too many messages just now. Please try again in a few minutes.",
    };
  }

  return { ok: false, message: GENERIC_ERROR_MESSAGE };
}
