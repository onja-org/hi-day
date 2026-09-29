/**
 * Converts the form's `YYYY-MM-DD` date input to the API's expiry: the end
 * of that day in the viewer's time zone, so a link "expiring Oct 4" still
 * works all of Oct 4. A blank input means it never expires. `fromInviteLinkExpiry`
 * goes the other way, for pre-filling the edit form.
 */
export function toInviteLinkExpiry(dateInput: string): string | null {
  if (!dateInput) return null;
  const [year, month, day] = dateInput.split("-").map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
}

export function fromInviteLinkExpiry(expiresAt: string | null): string {
  if (!expiresAt) return "";
  const date = new Date(expiresAt);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
