import { API_URL } from "./apiUrl";
import type {
  CreateTimeEntryInput,
  CreateTimeEntryResult,
} from "@/types/timeEntry";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function createTimeEntry(
  organisationId: string,
  input: CreateTimeEntryInput,
): Promise<CreateTimeEntryResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/time-entries`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const entry = await response.json();
    return { ok: true, entry };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
