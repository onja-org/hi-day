import { GENERIC_ERROR_MESSAGE } from "./parseApiError";
import type { OverlapConflict, OverlappingEntry } from "@/types/timeEntry";

type ErrorBody = {
  message?: string[] | string;
  overlaps?: OverlappingEntry[];
  canMerge?: boolean;
};

/**
 * A refused add or edit: the server's message, plus the entries it ran into
 * when the refusal was an overlap, so the form can name them and offer to
 * merge. Reads the body once, as a failed response can't be read twice.
 */
export async function parseTimeEntrySaveError(
  response: Response,
): Promise<{ message: string; overlap?: OverlapConflict }> {
  const data = (await response.json().catch(() => null)) as ErrorBody | null;
  const message =
    (Array.isArray(data?.message) ? data.message[0] : data?.message) ??
    GENERIC_ERROR_MESSAGE;
  if (!Array.isArray(data?.overlaps) || data.overlaps.length === 0) {
    return { message };
  }
  return {
    message,
    overlap: { overlaps: data.overlaps, canMerge: data.canMerge === true },
  };
}
