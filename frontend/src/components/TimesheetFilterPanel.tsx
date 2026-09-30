"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { useDismissOnOutside } from "@/hooks/useDismissOnOutside";
import { countActiveFilters } from "@/lib/timesheetFilters";
import type { TimesheetFilters } from "@/lib/timesheetFilters";
import type { ActiveMember } from "@/types/membership";
import type { TimeEntrySource } from "@/types/timeEntry";
import { FilterCheckboxList } from "./FilterCheckboxList";

/** Our three real sources, named as a person would describe them rather than
 * by the enum value stored on the entry. */
const SOURCE_OPTIONS: { id: TimeEntrySource; name: string }[] = [
  { id: "agent", name: "Desktop app" },
  { id: "web", name: "Web timer" },
  { id: "manual", name: "Added by hand" },
];

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

function toggled(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  if (!next.delete(id)) next.add(id);
  return next;
}

/**
 * The timesheet's filter drawer. Every section narrows the same list and they
 * apply together — see `filterTimeEntries`.
 *
 * Deliberately not a copy of every filter Hubstaff offers: activity level and
 * idle time have no data behind them in this product (activity samples were
 * dropped, and idle time is never recorded per entry), and a control that
 * silently matches nothing is worse than one that isn't there.
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

  // Off-screen on the first paint, then slid in on the next frame — setting
  // both states in one render would give the browser nothing to animate
  // between. Same approach as `Modal`.
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
        "fixed top-0 right-0 z-40 flex h-full w-full max-w-sm flex-col gap-6 overflow-y-auto border-l border-input-border bg-white p-6 shadow-lg",
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
        <label className="flex flex-col gap-2">
          <span className="text-xs font-medium tracking-wide text-slate-900/60 uppercase">
            Member
          </span>
          <select
            value={memberValue}
            onChange={(event) => onMemberChange(event.target.value)}
            className="rounded-md border border-input-border bg-white px-3 h-11 text-sm text-slate-900"
          >
            <option value="">{ownLabel}</option>
            {otherMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name ?? member.email}
              </option>
            ))}
          </select>
        </label>
      )}

      <FilterCheckboxList
        label="Project"
        searchable
        options={projectOptions}
        selected={filters.projectIds}
        onToggle={(id) =>
          onChange({ ...filters, projectIds: toggled(filters.projectIds, id) })
        }
        onSelectAll={(ids) =>
          onChange({
            ...filters,
            projectIds: ids.every((id) => filters.projectIds.has(id))
              ? new Set()
              : new Set(ids),
          })
        }
        emptyLabel="No projects in this date range."
      />

      <FilterCheckboxList
        label="Source"
        options={SOURCE_OPTIONS}
        selected={filters.sources}
        onToggle={(id) =>
          onChange({
            ...filters,
            sources: toggled(filters.sources, id) as Set<TimeEntrySource>,
          })
        }
        onSelectAll={(ids) =>
          onChange({
            ...filters,
            sources: ids.every((id) => filters.sources.has(id as TimeEntrySource))
              ? new Set()
              : (new Set(ids) as Set<TimeEntrySource>),
          })
        }
        emptyLabel="No sources available."
      />

      <button
        type="button"
        disabled={activeCount === 0}
        onClick={() => onChange({ projectIds: new Set(), sources: new Set() })}
        className="cursor-pointer rounded-md border border-input-border px-4 h-11 text-sm font-medium text-slate-900 transition-colors duration-150 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:text-slate-900/40 disabled:hover:border-input-border"
      >
        Clear filters
      </button>
    </div>,
    document.body,
  );
}
