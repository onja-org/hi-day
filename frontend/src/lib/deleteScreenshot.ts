import { API_URL } from "./apiUrl";
import { GENERIC_ERROR_MESSAGE, parseApiErrorMessage } from "./parseApiError";
import type { ApiResult } from "@/types/api";

/** Removes one screenshot and the image behind it. Permanent. */
export async function deleteScreenshot(
  organisationId: string,
  screenshotId: string,
): Promise<ApiResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/screenshots/${screenshotId}`,
      { method: "DELETE", credentials: "include" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  return response.ok
    ? { ok: true, message: 'Screenshot deleted' }
    : { ok: false, message: await parseApiErrorMessage(response) };
}
