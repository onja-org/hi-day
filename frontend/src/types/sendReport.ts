export type SendReportFileType = "pdf" | "csv";

export type SendReportInput = {
  emails: string[];
  subject: string;
  message: string;
  fileType: SendReportFileType;
};
