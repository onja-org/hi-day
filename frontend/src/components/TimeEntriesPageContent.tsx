"use client";

import { useState } from "react";
import { useActiveMembers } from "@/hooks/useActiveMembers";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import type { TimesheetDatePreset } from "@/lib/getTimesheetDateRange";
import { TimeEntryFormModal } from "./TimeEntryFormModal";
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
  const [datePreset, setDatePreset] = useState<TimesheetDatePreset>("today");

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
          <label className="sr-only" htmlFor="timesheet-date-filter">
            Date range
          </label>
          <select
            id="timesheet-date-filter"
            value={datePreset}
            onChange={(event) => setDatePreset(event.target.value as TimesheetDatePreset)}
            className="rounded-md border border-input-border bg-white px-3 py-1.5 text-sm text-slate-900"
          >
            {Object.entries(DATE_PRESET_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
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

      <TimesheetTable
        organisationId={organisationId}
        membershipId={isOwnTimesheet ? undefined : viewingMembershipId}
        datePreset={datePreset}
      />

      {addingTime && (
        <TimeEntryFormModal
          organisationId={organisationId}
          onClose={() => setAddingTime(false)}
        />
      )}
    </div>
  );
}
