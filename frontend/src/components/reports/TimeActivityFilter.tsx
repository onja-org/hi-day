"use client";

import { useState } from "react";
import { FunnelIcon } from "@phosphor-icons/react";
import { useProjectsEnabled } from "@/hooks/useProjectsEnabled";
import { countReportFilters } from "@/lib/reportFilters";
import type { ReportFilters } from "@/lib/reportFilters";
import type { ReportFilterOption } from "@/types/reportFilterOption";
import { ReportFilterPanel } from "./ReportFilterPanel";

type TimeActivityFilterProps = {
  filters: ReportFilters;
  onChange: (filters: ReportFilters) => void;
  projectOptions: ReportFilterOption[];
  /** Pass only when other people's data is on screen. */
  memberOptions?: ReportFilterOption[];
  teamOptions?: ReportFilterOption[];
};

/** The Filter button (with a badge counting active choices) and its drawer. */
export function TimeActivityFilter({
  filters,
  onChange,
  projectOptions,
  memberOptions,
  teamOptions,
}: TimeActivityFilterProps) {
  const projectsEnabled = useProjectsEnabled();
  const [open, setOpen] = useState(false);
  const activeCount = countReportFilters(filters);

  // The drawer offers members, teams and projects, each only when there is
  // something to choose. With none of them the button opens an empty panel.
  const hasAnythingToFilter =
    projectsEnabled || (memberOptions?.length ?? 0) > 0 || (teamOptions?.length ?? 0) > 0;
  if (!hasAnythingToFilter) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className="flex h-11 cursor-pointer items-center gap-2 rounded-brand-sm border-2 border-ink px-4 text-sm font-semibold text-slate-900 transition-colors duration-150 hover:border-primary hover:text-primary"
      >
        <FunnelIcon size={16} aria-hidden="true" />
        Filter
        {activeCount > 0 && <span className="tabular-nums">({activeCount})</span>}
      </button>
      {open && (
        <ReportFilterPanel
          filters={filters}
          onChange={onChange}
          projectOptions={projectOptions}
          memberOptions={memberOptions}
          teamOptions={teamOptions}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
