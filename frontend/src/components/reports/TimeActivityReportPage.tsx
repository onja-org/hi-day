"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaretLeftIcon } from "@phosphor-icons/react";
import { DateRangePicker } from "@/components/DateRangePicker";
import { ErrorMessage } from "@/components/ErrorMessage";
import { SelectField } from "@/components/ui/form/SelectField";
import { Spinner } from "@/components/Spinner";
import { useSavedReports } from "@/hooks/useSavedReports";
import { useTimeActivityReportControls, DEFAULT_TIME_ACTIVITY_PRESET } from "@/hooks/useTimeActivityReportControls";
import { useTimeActivityReportData } from "@/hooks/useTimeActivityReportData";
import { dateKeyInZone } from "@/lib/timezone";
import { TIME_ACTIVITY_GROUPINGS } from "@/lib/timeActivityReportConfig";
import type { ReportSchedule } from "@/types/reportSchedule";
import type { SavedReport } from "@/types/savedReport";
import type { TimeActivityGrouping } from "@/types/timeActivityGrouping";
import { ReportScopeTabs } from "./ReportScopeTabs";
import { TimeActivityReportActions } from "./TimeActivityReportActions";
import { TimeActivityReportBody } from "./TimeActivityReportBody";

type TimeActivityReportPageProps = {
  organisationId: string;
  /** Set when a saved report is opened: restores its settings and updates it on Save. */
  savedReport?: SavedReport;
};

export function TimeActivityReportPage({ organisationId, savedReport }: TimeActivityReportPageProps) {
  const router = useRouter();
  const { saveReport } = useSavedReports(organisationId);
  const controls = useTimeActivityReportControls(savedReport?.settings);
  const { scope, setScope, grouping, setGrouping, preset, setPreset, filters, setFilters, setCustomDays, zone, range } =
    controls;

  const {
    canViewOthers,
    showsEveryone,
    activeFilters,
    teamNames,
    members,
    teams,
    idleMembers,
    entries,
    projectOptions,
    isLoading,
    error,
  } = useTimeActivityReportData(organisationId, scope, range, filters);

  // Saves (or, on an already-saved report, updates) this report's current
  // settings; a brand-new one opens at its own address.
  function persist(input: { name: string; scheduled: boolean; schedule?: ReportSchedule }) {
    const id = saveReport({
      id: savedReport?.id,
      ...input,
      settings: {
        datePreset: preset,
        days: { from: dateKeyInZone(range.from, zone), to: dateKeyInZone(range.to, zone) },
        scope: showsEveryone ? "all" : "me",
        grouping,
        filters: activeFilters,
      },
    });
    if (!savedReport) router.push(`/organisations/${organisationId}/reports/saved/${id}`);
  }

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
        <h1 className="text-2xl font-semibold text-primary-dark">
          Time and activity report{savedReport && ` - ${savedReport.name}`}
        </h1>
      </header>

      {canViewOthers && <ReportScopeTabs value={scope} onChange={setScope} />}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <DateRangePicker
            id="time-activity-date-range"
            label="Date range"
            value={range}
            preset={preset}
            defaultPreset={DEFAULT_TIME_ACTIVITY_PRESET}
            zone={zone}
            onChange={(next, nextPreset) => {
              setCustomDays({ from: dateKeyInZone(next.from, zone), to: dateKeyInZone(next.to, zone) });
              setPreset(nextPreset);
            }}
          />
        </div>
        <TimeActivityReportActions
          entries={entries}
          range={range}
          grouping={grouping}
          showsEveryone={showsEveryone}
          filters={activeFilters}
          onFiltersChange={setFilters}
          projectOptions={projectOptions}
          memberOptions={
            showsEveryone
              ? (members ?? []).map((member) => ({ id: member.id, name: member.name ?? member.email }))
              : undefined
          }
          teamOptions={teams}
          savedReport={savedReport}
          onPersist={persist}
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

      {grouping === "team" && (
        <p className="text-xs text-slate-900/70 italic">
          When grouping by team, members who belong to multiple teams may be counted more than once.
        </p>
      )}

      {isLoading && (
        <p className="flex items-center gap-2 text-slate-900">
          <Spinner className="text-primary-dark" />
          Loading report…
        </p>
      )}
      {error && <ErrorMessage message={error.message} />}
      {entries && <TimeActivityReportBody entries={entries} grouping={grouping} teamNames={teamNames} idleMembers={idleMembers} />}
    </div>
  );
}
