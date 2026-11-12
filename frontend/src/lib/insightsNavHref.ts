import { insightsHref } from "./insightsHref";
import type { InsightsPage } from "@/types/insights";

/**
 * Where a sidebar Insights link goes: your own copy of the page — picking
 * someone else is what "← All members" is for. Already looking at someone
 * in Insights, you stay on them, and the date range comes along too.
 */
export function insightsNavHref(
  page: InsightsPage,
  insightsBase: string,
  pathname: string,
  searchParams: URLSearchParams,
): string {
  const insideInsights =
    pathname === insightsBase || pathname.startsWith(`${insightsBase}/`);
  const carried = insideInsights ? searchParams : new URLSearchParams();
  return insightsHref(
    insightsBase,
    { kind: "page", page, member: carried.get("member") },
    carried,
  );
}
