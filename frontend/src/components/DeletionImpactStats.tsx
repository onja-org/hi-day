import { formatDuration } from "@/lib/formatDuration";
import type { OrganisationDeletionStatus } from "@/types/organisation";
import { useProjectsEnabled } from "@/hooks/useProjectsEnabled";

type DeletionImpactStatsProps = {
  impact: OrganisationDeletionStatus["impact"];
};

/** The four counts of what deleting would remove, so the owner sees the scale before confirming. */
export function DeletionImpactStats({ impact }: DeletionImpactStatsProps) {
  const projectsEnabled = useProjectsEnabled();
  const stats = [
    { value: String(impact.people), label: "people" },
    ...(projectsEnabled ? [{ value: String(impact.projects), label: "projects" }] : []),
    {
      value: formatDuration(Math.round(impact.trackedSeconds / 60)),
      label: "tracked time",
    },
    { value: String(impact.devices), label: "devices" },
  ];

  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {stats.map((stat) => (
        <li
          key={stat.label}
          className="flex flex-col rounded-md border border-input-border px-3 py-2"
        >
          <span className="font-semibold text-primary-dark">{stat.value}</span>
          <span className="text-xs text-slate-900/60">{stat.label}</span>
        </li>
      ))}
    </ul>
  );
}
