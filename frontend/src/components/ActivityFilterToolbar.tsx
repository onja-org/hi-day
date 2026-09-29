"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { differenceInCalendarDays } from "date-fns";
import { useActiveMembers } from "@/hooks/useActiveMembers";
import { useMyProfile } from "@/hooks/useMyProfile";
import { useProjects } from "@/hooks/useProjects";
import { getDayRange } from "@/lib/getDayRange";
import { DayNavigator } from "@/components/DayNavigator";
import { Label } from "@/components/ui/form/Label";
import { SearchableSelect } from "@/components/SearchableSelect";

type ActivityFilterToolbarProps = {
  organisationId: string;
  canViewOthers: boolean;
};

export function ActivityFilterToolbar({
  organisationId,
  canViewOthers,
}: ActivityFilterToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const membersQuery = useActiveMembers(organisationId);
  const profileQuery = useMyProfile();
  const profile = profileQuery.data;
  const projectsQuery = useProjects(organisationId, { status: "active" });

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
  const projectId = searchParams.get("projectId") ?? "";

  const otherMembers = membersQuery.data?.filter(
    (member) => member.email !== profile?.email,
  );
  const selfLabel = profile?.name ? `${profile.name} (You)` : "You";

  return (
    <div className="flex flex-wrap items-end gap-3">
      <DayNavigator
        label="Activity day"
        value={getDayRange(new Date(), dayOffset).start}
        onChange={(date) => {
          const offset = differenceInCalendarDays(date, new Date());
          updateParams({ day: offset === 0 ? null : String(offset) });
        }}
      />
      {canViewOthers && otherMembers && (
        <div className="flex flex-col gap-1">
          <Label>Member</Label>
          <SearchableSelect
            value={membershipId}
            onChange={(value) => updateParams({ membershipId: value || null })}
            ariaLabel="Filter by member"
            placeholder="Search people…"
            noMatchesLabel="No matching people"
            options={[
              { value: "", label: selfLabel },
              ...otherMembers.map((member) => ({
                value: member.id,
                label: member.name ?? member.email,
              })),
            ]}
          />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <Label>Project</Label>
        <SearchableSelect
          value={projectId}
          onChange={(value) => updateParams({ projectId: value || null })}
          ariaLabel="Filter by project"
          placeholder="Search projects…"
          noMatchesLabel="No matching projects"
          options={[
            { value: "", label: "All projects" },
            ...(projectsQuery.data?.map((project) => ({
              value: project.id,
              label: project.name,
            })) ?? []),
          ]}
        />
      </div>
    </div>
  );
}
