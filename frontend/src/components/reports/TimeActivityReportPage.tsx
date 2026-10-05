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
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { dateKeyInZone, timezoneAbbreviation, timezoneTooltip } from "@/lib/timezone";
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
  const organisationQuery = useCurrentOrganisation();
  const controls = useTimeActivityReportControls(savedReport?.settings, organisationQuery.data?.timezone);
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
  } = useTimeActivityReportData(organisationId, scope, range, filters, !organisationQuery.isLoading);

  // Saves (or, on an already-saved report, updates) this report's current
  // settings; a brand-new one then opens at its own address. Resolves with
  // a message when it couldn't be saved.
  async function persist(input: { name: string; schedule: ReportSchedule | null }): Promise<string | void> {
    const result = await saveReport({
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
    if (!result.ok) return result.message;
    if (!savedReport) router.push(`/organisations/${organisationId}/reports/saved/${result.report.id}`);
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
          <span className="pb-2.5 text-sm font-medium text-slate-900" title={timezoneTooltip(zone)}>
            {timezoneAbbreviation(zone)}
          </span>
        </div>
        <TimeActivityReportActions
          organisationId={organisationId}
          teamNames={teamNames}
          idleMembers={idleMembers}
          entries={entries}
          range={range}
          zone={zone}
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

      {(isLoading || organisationQuery.isLoading) && (
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
