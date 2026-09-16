import { API_URL } from "./apiUrl";
import type { CreateNoteInput, CreateNoteResult } from "@/types/note";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function createNote(
  organisationId: string,
  input: CreateNoteInput,
): Promise<CreateNoteResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/organisations/${organisationId}/notes`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const note = await response.json();
    return { ok: true, note };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
