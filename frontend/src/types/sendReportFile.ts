import type { SendReportFileType, SendReportInput } from "./sendReport";

export type SendReportFileOptions = {
  organisationId: string;
  input: SendReportInput;
  /** The file's name without its extension. */
  filenameBase: string;
  /** True when the report has nothing to send for the chosen range. */
  isEmpty: boolean;
  /** Builds the file the way the report currently looks, base64-encoded. */
  buildContent: (fileType: SendReportFileType, title: string) => Promise<string>;
};
