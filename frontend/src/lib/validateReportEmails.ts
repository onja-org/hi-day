import { findInvalidEmails } from "@/lib/findInvalidEmails";
import { parseInviteEmails } from "@/lib/parseInviteEmails";
import type { ReportEmailsValidation } from "@/types/reportEmailsValidation";

/** Parses a recipients field into addresses, with an error naming any that don't look like an email. An empty field has no error: the form's own required check handles it. */
export function validateReportEmails(text: string): ReportEmailsValidation {
  const emails = parseInviteEmails(text);
  const invalid = findInvalidEmails(emails);
  return {
    emails,
    error: invalid.length > 0 ? `Not a valid email address: ${invalid.join(", ")}` : null,
  };
}
