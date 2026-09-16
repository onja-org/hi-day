"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ActivityDayNavigator } from "./ActivityDayNavigator";
import { MemberFilterSelect } from "./MemberFilterSelect";
import { ProjectFilterSelect, UNTRACKED_PROJECT_VALUE } from "./ProjectFilterSelect";

type ActivityFilterToolbarProps = {
  organisationId: string;
  canViewOthers: boolean;
};

/**
 * The shared day/member/project filter row for the Activities pages. State
 * lives in the URL query string (`?day=&membershipId=&projectId=`), not
 * component state — the four tabs are four separate routes, so local state
 * can't survive a tab switch. `ActivityTabs` forwards the current query
 * string onto every tab's link so switching tabs keeps the same filters.
 */
export function ActivityFilterToolbar({
  organisationId,
  canViewOthers,
}: ActivityFilterToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Applies every key in `patch` to one URLSearchParams copy and navigates
  // once — a project-filter change touches both `projectId` and
  // `untracked` together, and two separate router.push calls would each
  // start from the same stale `searchParams` snapshot and clobber each
  // other instead of combining.
  function updateParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  const dayOffset = Number(searchParams.get("day") ?? "0") || 0;
  const membershipId = searchParams.get("membershipId") ?? "";
  const isUntracked = searchParams.get("untracked") === "1";
  const projectId = isUntracked
    ? UNTRACKED_PROJECT_VALUE
    : (searchParams.get("projectId") ?? "");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ActivityDayNavigator
        dayOffset={dayOffset}
        onChange={(offset) => updateParams({ day: offset === 0 ? null : String(offset) })}
      />
      <MemberFilterSelect
        organisationId={organisationId}
        value={membershipId}
        onChange={(value) => updateParams({ membershipId: value || null })}
        canViewOthers={canViewOthers}
      />
      <ProjectFilterSelect
        organisationId={organisationId}
        value={projectId}
        onChange={(value) => {
          if (value === UNTRACKED_PROJECT_VALUE) {
            updateParams({ projectId: null, untracked: "1" });
          } else {
            updateParams({ untracked: null, projectId: value || null });
          }
        }}
      />
    </div>
  );
}
