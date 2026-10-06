export type SendReportFileType = "pdf" | "csv";

export type SendReportInput = {
  emails: string[];
  subject: string;
  message: string;
  fileType: SendReportFileType;
};

/** What the backend's send endpoint takes: the file is built in the browser and sent as base64. */
export type SendReportRequest = SendReportInput & {
  filename: string;
  contentBase64: string;
};

export type SendReportResult = { ok: true; message: string } | { ok: false; message: string };
