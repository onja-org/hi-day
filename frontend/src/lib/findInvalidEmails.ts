// Deliberately loose: one "@" with something either side and a dot in the
// domain. The mail server is the real judge; this only catches typos.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The entries of `emails` that don't look like an email address. */
export function findInvalidEmails(emails: string[]): string[] {
  return emails.filter((email) => !EMAIL_SHAPE.test(email));
}
