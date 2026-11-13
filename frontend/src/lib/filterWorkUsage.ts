import type { WorkItemKind, WorkLabelChoice, WorkUsageItem } from "@/types/workClassification";

export type WorkUsageFilter = {
  kind: WorkItemKind | "all";
  label: WorkLabelChoice | "all";
  /** Matched anywhere in the name, ignoring case. */
  search: string;
};

/** The labelling list narrowed to what the admin is looking for; order is kept (most time first). */
export function filterWorkUsage(items: WorkUsageItem[], filter: WorkUsageFilter): WorkUsageItem[] {
  const search = filter.search.trim().toLowerCase();
  return items.filter(
    (item) =>
      (filter.kind === "all" || item.kind === filter.kind) &&
      (filter.label === "all" || item.label === filter.label) &&
      (search === "" || item.name.toLowerCase().includes(search)),
  );
}
