import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { CutMode, CutTimeEntryRangeResult } from "@/types/timeEntry";

/** Removes `[from, to)` from a stopped entry, or splits it there into three. */
export async function cutTimeEntryRange(
  organisationId: string,
  timeEntryId: string,
  input: { from: string; to: string; mode: CutMode; reason?: string },
): Promise<CutTimeEntryRangeResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/time-entries/${timeEntryId}/cut`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: new Date(input.from).toISOString(),
          to: new Date(input.to).toISOString(),
          mode: input.mode,
          ...(input.reason ? { reason: input.reason } : {}),
        }),
      },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const body = await response.json();
    return { ok: true, ...body };
  }
  return { ok: false, message: await parseApiErrorMessage(response) };
}
