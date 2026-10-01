"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { useDismissOnOutside } from "@/hooks/useDismissOnOutside";
import { EMPTY_REPORT_FILTERS, countReportFilters } from "@/lib/reportFilters";
import type { ReportFilters } from "@/lib/reportFilters";

type Option = { id: string; name: string };

type ReportFilterPanelProps = {
  filters: ReportFilters;
  onChange: (filters: ReportFilters) => void;
  projectOptions: Option[];
  /** Omit to leave the Members filter out — e.g. when only your own data is shown. */
  memberOptions?: Option[];
  /** Omit to leave the Teams filter out. */
  teamOptions?: Option[];
  onClose: () => void;
};

/**
 * The report's filter drawer: Members, Teams and Projects, each optional
 * and shown only when it has options. Portalled into document.body for the
 * same reason `Modal` is — a transformed ancestor would otherwise become
 * the containing block for this `fixed` panel.
 */
export function ReportFilterPanel({
  filters,
  onChange,
  projectOptions,
  memberOptions,
  teamOptions,
  onClose,
}: ReportFilterPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDismissOnOutside(true, [panelRef], onClose);

  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Report filters"
      className={clsx(
        "fixed top-0 right-0 z-40 flex h-full w-full max-w-sm flex-col gap-5 overflow-y-auto border-l border-input-border bg-white p-6 shadow-lg transition-transform duration-300 ease-out",
        visible && "translate-x-0",
        !visible && "translate-x-full",
      )}
    >
      <div className="flex items-center justify-between">
        <h2 className="border-b-2 border-primary pb-1 text-sm font-semibold tracking-wide text-primary uppercase">
          Filters
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close filters"
          className="cursor-pointer rounded-full p-1 text-primary-dark transition-colors duration-150 hover:bg-cream"
        >
          <XIcon size={18} aria-hidden="true" />
        </button>
      </div>

      {memberOptions && memberOptions.length > 0 && (
        <MultiSelectFilter
          label="Members"
          placeholder="All members"
          options={memberOptions}
          selected={filters.memberIds}
          onChange={(memberIds) => onChange({ ...filters, memberIds })}
          searchable
        />
      )}

      {teamOptions && teamOptions.length > 0 && (
        <MultiSelectFilter
          label="Teams"
          placeholder="All teams"
          options={teamOptions}
          selected={filters.teamIds}
          onChange={(teamIds) => onChange({ ...filters, teamIds })}
          searchable
        />
      )}

      <MultiSelectFilter
        label="Projects"
        placeholder="All projects"
        options={projectOptions}
        selected={filters.projectIds}
        onChange={(projectIds) => onChange({ ...filters, projectIds })}
        searchable
        emptyLabel="There are no projects to filter by."
      />

      <button
        type="button"
        disabled={countReportFilters(filters) === 0}
        onClick={() => onChange(EMPTY_REPORT_FILTERS)}
        className="cursor-pointer rounded-md border border-input-border px-4 py-2 text-sm font-medium text-slate-900 transition-colors duration-150 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:text-slate-900/40 disabled:hover:border-input-border"
      >
        Clear filters
      </button>
    </div>,
    document.body,
  );
}
