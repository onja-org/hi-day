"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { useDismissOnOutside } from "@/hooks/useDismissOnOutside";
import {
  ACTIVITY_LEVEL_THRESHOLDS,
  EMPTY_TIMESHEET_FILTERS,
  countActiveFilters,
} from "@/lib/timesheetFilters";
import type { TimesheetFilters } from "@/lib/timesheetFilters";
import type { ActiveMember } from "@/types/membership";
import type { TimeEntrySource, TimeEntryType } from "@/types/timeEntry";
import { MultiSelectFilter } from "./MultiSelectFilter";
import { SearchableSelect } from "./SearchableSelect";
import type { SearchableSelectOption } from "./SearchableSelect";

/** Our three real sources, named as a person would describe them rather than
 * by the enum value stored on the entry. */
const SOURCE_OPTIONS: { id: TimeEntrySource; name: string }[] = [
  { id: "agent", name: "Desktop app" },
  { id: "web", name: "Web timer" },
  { id: "manual", name: "Added by hand" },
];

const TIME_TYPE_OPTIONS: { id: TimeEntryType; name: string }[] = [
  { id: "normal", name: "Normal" },
  { id: "idle", name: "Idle" },
  { id: "resumed", name: "Resumed" },
  { id: "manual", name: "Manual" },
];

/** The signed-in account first, then everyone else — the same list the
 * header picker shows, built once so the two can't drift. */
export function memberOptions(
  ownLabel: string,
  otherMembers: ActiveMember[],
): SearchableSelectOption[] {
  return [
    { value: "", label: ownLabel },
    ...otherMembers.map((member) => ({
      value: member.id,
      label: member.name ?? member.email,
    })),
  ];
}

type TimesheetFilterPanelProps = {
  filters: TimesheetFilters;
  onChange: (filters: TimesheetFilters) => void;
  projectOptions: { id: string; name: string }[];
  /** Member is a *query* filter, not a client-side one — it decides which
   * entries are fetched — so it is passed through rather than held here. */
  memberValue: string;
  onMemberChange: (membershipId: string) => void;
  ownLabel: string;
  otherMembers: ActiveMember[];
  canViewOthers: boolean;
  onClose: () => void;
};

/**
 * The timesheet's filter drawer. Every section narrows the same list and they
 * apply together — see `filterTimeEntries`.
 *
 * Portalled into document.body for the same reason `Modal` is: the page
 * content sits inside `FadeIn`, whose translate classes make it the
 * containing block for any `fixed` descendant — so in-tree this panel would
 * stop at that element's edge instead of the viewport's.
 */
export function TimesheetFilterPanel({
  filters,
  onChange,
  projectOptions,
  memberValue,
  onMemberChange,
  ownLabel,
  otherMembers,
  canViewOthers,
  onClose,
}: TimesheetFilterPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDismissOnOutside(true, [panelRef], onClose);

  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const activeCount = countActiveFilters(filters);

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Timesheet filters"
      className={clsx(
        "fixed top-0 right-0 z-40 flex h-full w-full max-w-sm flex-col gap-5 overflow-y-auto border-l border-input-border bg-white p-6 shadow-lg",
        "transition-transform duration-300 ease-out",
        visible ? "translate-x-0" : "translate-x-full",
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

      {canViewOthers && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium tracking-wide text-slate-900/60 uppercase">
            Member
          </span>
          <SearchableSelect
            ariaLabel="Whose timesheet to view"
            value={memberValue}
            onChange={onMemberChange}
            options={memberOptions(ownLabel, otherMembers)}
            placeholder="Search members"
            noMatchesLabel="No members match"
          />
        </div>
      )}

      <MultiSelectFilter
        label="Project / work order"
        placeholder="All projects / work orders"
        options={projectOptions}
        selected={filters.projectIds}
        onChange={(projectIds) => onChange({ ...filters, projectIds })}
        searchable
        emptyLabel="You're not assigned to any projects."
      />

      <MultiSelectFilter
        label="Time type"
        placeholder="All types"
        options={TIME_TYPE_OPTIONS}
        selected={filters.timeTypes}
        onChange={(timeTypes) =>
          onChange({ ...filters, timeTypes: timeTypes as TimeEntryType[] })
        }
      />

      <MultiSelectFilter
        label="Source"
        placeholder="All sources"
        options={SOURCE_OPTIONS}
        selected={filters.sources}
        onChange={(sources) =>
          onChange({ ...filters, sources: sources as TimeEntrySource[] })
        }
      />

      <MultiSelectFilter
        label="Activity level"
        placeholder="All levels"
        single
        options={ACTIVITY_LEVEL_THRESHOLDS.map((threshold) => ({
          id: String(threshold),
          name: `> ${threshold}%`,
        }))}
        selected={
          filters.minActivePercentage === null
            ? []
            : [String(filters.minActivePercentage)]
        }
        onChange={(chosen) =>
          onChange({
            ...filters,
            // "All levels" is the placeholder, not an option: clearing the
            // chip is what returns to every level.
            minActivePercentage: chosen.length === 0 ? null : Number(chosen[0]),
          })
        }
      />

      <button
        type="button"
        disabled={activeCount === 0}
        onClick={() => onChange(EMPTY_TIMESHEET_FILTERS)}
        className="cursor-pointer rounded-md border border-input-border px-4 py-2 text-sm font-medium text-slate-900 transition-colors duration-150 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:text-slate-900/40 disabled:hover:border-input-border"
      >
        Clear filters
      </button>
    </div>,
    document.body,
  );
}
