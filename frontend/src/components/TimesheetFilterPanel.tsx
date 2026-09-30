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

const FIELD_CLASSES =
  "rounded-md border border-input-border bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

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
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium tracking-wide text-slate-900/60 uppercase">
            Member
          </span>
          <select
            value={memberValue}
            onChange={(event) => onMemberChange(event.target.value)}
            className={FIELD_CLASSES}
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

      <MultiSelectFilter
        label="Project / work order"
        placeholder="All projects / work orders"
        options={projectOptions}
        selected={filters.projectIds}
        onChange={(projectIds) => onChange({ ...filters, projectIds })}
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

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium tracking-wide text-slate-900/60 uppercase">
          Activity level
        </span>
        {/* The one single-value filter: thresholds nest, so "> 90%" and
            "> 60%" together could only ever mean "> 60%". */}
        <select
          value={filters.minActivePercentage ?? ""}
          onChange={(event) =>
            onChange({
              ...filters,
              minActivePercentage: event.target.value
                ? Number(event.target.value)
                : null,
            })
          }
          className={FIELD_CLASSES}
        >
          <option value="">All levels</option>
          {ACTIVITY_LEVEL_THRESHOLDS.map((threshold) => (
            <option key={threshold} value={threshold}>
              &gt; {threshold}%
            </option>
          ))}
        </select>
      </label>

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
