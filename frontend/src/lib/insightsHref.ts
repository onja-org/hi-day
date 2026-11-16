import type { InsightsDestination } from "@/types/insights";

/** The date range every Insights page reads — carried along so it survives navigation. */
const DATE_KEYS = ["preset", "from", "to"] as const;

/**
 * The URL for an Insights destination, keeping the date range from
 * `searchParams`. The member comes from the destination, never from the
 * current URL, so a link can't accidentally carry someone along.
 */
export function insightsHref(
  insightsBase: string,
  destination: InsightsDestination,
  searchParams: URLSearchParams,
): string {
  const query = new URLSearchParams();
  if (destination.kind === "page" && destination.member) {
    query.set("member", destination.member);
  }
  if (destination.kind === "list") {
    query.set("page", destination.page);
  }
  for (const key of DATE_KEYS) {
    const value = searchParams.get(key);
    if (value) query.set(key, value);
  }

  const path =
    destination.kind === "page" ? `${insightsBase}/${destination.page}` : insightsBase;
  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
}
