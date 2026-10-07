/** The addresses typed into a report's recipients field, and why they can't be used (null when they can). */
export type ReportEmailsValidation = {
  emails: string[];
  error: string | null;
};
