/** A date like "Mon, Feb 19, 2024" in the viewer's locale. */
export function formatShortDate(value: string | Date, locale?: string): string {
  return new Date(value).toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
