import { sendReport } from "@/lib/sendReport";
import type { SendReportFileOptions } from "@/types/sendReportFile";

/**
 * Builds the report file the way it currently looks, then has the backend
 * email it. Resolves with a message on failure, nothing on success.
 */
export async function sendReportFile({
  organisationId,
  input,
  filenameBase,
  isEmpty,
  buildContent,
}: SendReportFileOptions): Promise<string | void> {
  if (isEmpty) return "There's nothing to send for this date range.";
  try {
    const contentBase64 = await buildContent(input.fileType, input.subject);
    const result = await sendReport(organisationId, {
      ...input,
      filename: `${filenameBase}.${input.fileType}`,
      contentBase64,
    });
    if (!result.ok) return result.message;
  } catch {
    return "The report file could not be built. Please try again.";
  }
}
