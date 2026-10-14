import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteScreenshot } from "@/lib/deleteScreenshot";
import type { ApiResult } from "@/types/api";

export type ScreenshotDeleteResult = ApiResult<
  { deleted: number },
  { deleted: number }
>;

function summarise(
  deleted: number,
  failureMessage: string | null,
): ScreenshotDeleteResult {
  const noun = deleted === 1 ? "screenshot" : "screenshots";
  if (!failureMessage) {
    return { ok: true, message: `${deleted} ${noun} deleted`, deleted };
  }
  if (deleted === 0) {
    return { ok: false, message: failureMessage, deleted };
  }
  return {
    ok: false,
    message: `${deleted} ${noun} deleted, the rest could not be: ${failureMessage}`,
    deleted,
  };
}

/**
 * Deletes one or several screenshots. There is no bulk endpoint, so this
 * issues one DELETE each and a batch can be *partly* applied — hence a
 * count rather than an all-or-nothing claim. Only the first failure's
 * message is surfaced: refusals in one batch share the same reason.
 */
export function useDeleteScreenshots(
  organisationId: string,
  onFinished: () => void,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      screenshotIds: string[],
    ): Promise<ScreenshotDeleteResult> => {
      const results = await Promise.all(
        screenshotIds.map((id) => deleteScreenshot(organisationId, id)),
      );
      const failures = results.filter((result) => !result.ok);
      return summarise(
        results.length - failures.length,
        failures[0]?.message ?? null,
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["screenshots"] });
      onFinished();
    },
  });
}
