"use client";

import { useState } from "react";
import clsx from "clsx";
import { useActiveMembers } from "@/hooks/useActiveMembers";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import type { TimesheetDatePreset } from "@/lib/getTimesheetDateRange";
import { TimeEntryFormModal } from "./TimeEntryFormModal";
import { TimesheetDailyChart } from "./TimesheetDailyChart";
import { TimesheetProjectBreakdown } from "./TimesheetProjectBreakdown";
import { TimesheetSummaryTiles } from "./TimesheetSummaryTiles";
import { TimesheetTable } from "./TimesheetTable";

type TimeEntriesPageContentProps = {
  organisationId: string;
};

const DATE_PRESET_LABELS: Record<TimesheetDatePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  this_week: "This week",
  this_month: "This month",
  all: "All time",
};

export function TimeEntriesPageContent({ organisationId }: TimeEntriesPageContentProps) {
  const [addingTime, setAddingTime] = useState(false);
  // "" means "my own timesheet" — the default for everyone, including
  // admins/managers.
  const [viewingMembershipId, setViewingMembershipId] = useState("");
  // "this_week" (not "today") so the daily chart has something to show by
  // default — a single day doesn't make a useful chart.
  const [datePreset, setDatePreset] = useState<TimesheetDatePreset>("this_week");

  const organisationQuery = useCurrentOrganisation();
  const canViewOthers =
    organisationQuery.data?.role === "admin" || organisationQuery.data?.role === "manager";
  const membersQuery = useActiveMembers(organisationId);

  const isOwnTimesheet = viewingMembershipId === "";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-primary-dark">Timesheets</h1>
          <div
            role="group"
            aria-label="Date range"
            className="inline-flex rounded-lg border border-input-border p-1"
          >
            {Object.entries(DATE_PRESET_LABELS).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={datePreset === value}
                onClick={() => setDatePreset(value as TimesheetDatePreset)}
                className={clsx(
                  "cursor-pointer rounded-md px-3 py-1 text-sm font-medium transition-colors duration-150",
                  datePreset === value
                    ? "bg-primary text-white"
                    : "text-slate-900 hover:bg-cream",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {canViewOthers && membersQuery.data && (
            <select
              value={viewingMembershipId}
              onChange={(event) => setViewingMembershipId(event.target.value)}
              className="rounded-md border border-input-border bg-white px-3 py-1.5 text-sm text-slate-900"
            >
              <option value="">My timesheet</option>
              {membersQuery.data.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name ?? member.email}
                </option>
              ))}
            </select>
          )}
        </div>
        {isOwnTimesheet && (
          <button
            type="button"
            onClick={() => setAddingTime(true)}
            className="cursor-pointer rounded-md bg-primary px-4 py-2 text-white transition-colors duration-150 hover:bg-primary/90"
          >
            Add time
          </button>
        )}
      </div>

      <TimesheetSummaryTiles
        organisationId={organisationId}
        membershipId={isOwnTimesheet ? undefined : viewingMembershipId}
        datePreset={datePreset}
      />

      {(datePreset === "this_week" || datePreset === "this_month") && (
        <TimesheetDailyChart
          organisationId={organisationId}
          membershipId={isOwnTimesheet ? undefined : viewingMembershipId}
          datePreset={datePreset}
        />
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-primary-dark">By project</h2>
        <TimesheetProjectBreakdown
          organisationId={organisationId}
          membershipId={isOwnTimesheet ? undefined : viewingMembershipId}
          datePreset={datePreset}
        />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-primary-dark">Entries</h2>
        <TimesheetTable
          organisationId={organisationId}
          membershipId={isOwnTimesheet ? undefined : viewingMembershipId}
          datePreset={datePreset}
        />
      </div>

      {addingTime && (
        <TimeEntryFormModal
          organisationId={organisationId}
          onClose={() => setAddingTime(false)}
        />
      )}
    </div>
  );
}
