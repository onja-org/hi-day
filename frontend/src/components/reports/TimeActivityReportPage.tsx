"use client";

import { useState } from "react";
import Link from "next/link";
import { CaretLeftIcon } from "@phosphor-icons/react";
import { format } from "date-fns";
import { DateRangePicker } from "@/components/DateRangePicker";
import { ErrorMessage } from "@/components/ErrorMessage";
import { ExportButtons } from "@/components/ExportButtons";
import { SelectField } from "@/components/ui/form/SelectField";
import { Spinner } from "@/components/Spinner";
import { useActiveMembers } from "@/hooks/useActiveMembers";
import { useAllMembersTimeEntries } from "@/hooks/useAllMembersTimeEntries";
import { useCanViewOthers } from "@/hooks/useCanViewOthers";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { entriesToCsv } from "@/lib/entriesToCsv";
import { TIME_ACTIVITY_GROUPINGS } from "@/lib/timeActivityReportConfig";
import { getTimesheetDateRange } from "@/lib/getTimesheetDateRange";
import type { DateRange, DateRangePreset } from "@/types/dateRange";
import type { ReportScope } from "@/types/reportScope";
import type { TimeActivityGrouping } from "@/types/timeActivityGrouping";
import { ReportScopeTabs } from "./ReportScopeTabs";
import { TimeActivityReportBody } from "./TimeActivityReportBody";

type TimeActivityReportPageProps = {
  organisationId: string;
};

const DEFAULT_PRESET: DateRangePreset = "last_7_days";

export function TimeActivityReportPage({ organisationId }: TimeActivityReportPageProps) {
  const [scope, setScope] = useState<ReportScope>("me");
  const [grouping, setGrouping] = useState<TimeActivityGrouping>("day");
  const [preset, setPreset] = useState<DateRangePreset | null>(DEFAULT_PRESET);
  const [customRange, setCustomRange] = useState<DateRange>(() =>
    getTimesheetDateRange(DEFAULT_PRESET),
  );
  const range = preset ? getTimesheetDateRange(preset) : customRange;

  // Only admins/managers get the "All" tab; everyone else only ever sees
  // their own data. The membership list the backend returns is already
  // limited to who the viewer's role may see, so "All" can't over-reach.
  const canViewOthers = useCanViewOthers();
  const membersQuery = useActiveMembers(organisationId, { enabled: canViewOthers });
  const isAll = canViewOthers && scope === "all";
  const ownQuery = useTimeEntries(
    organisationId,
    { from: range.from, to: range.to },
    { enabled: !isAll },
  );
  const allQuery = useAllMembersTimeEntries(
    organisationId,
    (membersQuery.data ?? []).map((member) => member.id),
    range,
    isAll && !membersQuery.isLoading,
  );
  const isLoading = isAll ? membersQuery.isLoading || allQuery.isLoading : ownQuery.isLoading;
  const error = isAll ? (membersQuery.error ?? allQuery.error) : ownQuery.error;
  const entries = isAll ? (membersQuery.isLoading ? undefined : allQuery.data) : ownQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href={`/organisations/${organisationId}/reports/all`}
          className="flex w-fit items-center gap-1 text-sm text-primary hover:underline"
        >
          <CaretLeftIcon size={14} aria-hidden="true" />
          Reports
        </Link>
        <h1 className="text-2xl font-semibold text-primary-dark">Time and activity report</h1>
      </header>

      {canViewOthers && <ReportScopeTabs value={scope} onChange={setScope} />}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <DateRangePicker
            id="time-activity-date-range"
            label="Date range"
            value={range}
            preset={preset}
            defaultPreset={DEFAULT_PRESET}
            onChange={(next, nextPreset) => {
              setCustomRange(next);
              setPreset(nextPreset);
            }}
          />
        </div>
        <ExportButtons
          csv={entriesToCsv(entries ?? [])}
          filenameBase={`time-and-activity-${format(range.from, "yyyy-MM-dd")}-to-${format(range.to, "yyyy-MM-dd")}`}
          disabled={(entries ?? []).length === 0}
        />
      </div>

      <SelectField
        label="Data grouped by"
        value={grouping}
        onChange={(event) => setGrouping(event.target.value as TimeActivityGrouping)}
        className="w-fit"
      >
        {TIME_ACTIVITY_GROUPINGS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>

      {isLoading && (
        <p className="flex items-center gap-2 text-slate-900">
          <Spinner className="text-primary-dark" />
          Loading report…
        </p>
      )}
      {error && <ErrorMessage message={error.message} />}
      {entries && <TimeActivityReportBody entries={entries} grouping={grouping} scope={isAll ? "all" : "me"} />}
    </div>
  );
}
