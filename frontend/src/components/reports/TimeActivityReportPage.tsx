"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaretLeftIcon } from "@phosphor-icons/react";
import { format } from "date-fns";
import { DateRangePicker } from "@/components/DateRangePicker";
import { ErrorMessage } from "@/components/ErrorMessage";
import { ExportButtons } from "@/components/ExportButtons";
import { SelectField } from "@/components/ui/form/SelectField";
import { Spinner } from "@/components/Spinner";
import { useSavedReports } from "@/hooks/useSavedReports";
import { useTimeActivityReportControls, DEFAULT_TIME_ACTIVITY_PRESET } from "@/hooks/useTimeActivityReportControls";
import { useTimeActivityReportData } from "@/hooks/useTimeActivityReportData";
import { countReportFilters } from "@/lib/reportFilters";
import { dateKeyInZone } from "@/lib/timezone";
import { entriesToCsv } from "@/lib/entriesToCsv";
import { TIME_ACTIVITY_GROUPINGS } from "@/lib/timeActivityReportConfig";
import type { SavedReport } from "@/types/savedReport";
import type { TimeActivityGrouping } from "@/types/timeActivityGrouping";
import { SaveReportButton } from "./SaveReportButton";
import { TimeActivityFilter } from "./TimeActivityFilter";
import { ReportScopeTabs } from "./ReportScopeTabs";
import { TimeActivityReportBody } from "./TimeActivityReportBody";
import { TimeActivityReportSettings } from "./TimeActivityReportSettings";

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
        <div className="flex flex-wrap items-center gap-3">
          <ExportButtons
            csv={entriesToCsv(entries ?? [])}
            filenameBase={`time-and-activity-${format(range.from, "yyyy-MM-dd")}-to-${format(range.to, "yyyy-MM-dd")}`}
            disabled={(entries ?? []).length === 0}
          />
          <TimeActivityFilter
            filters={activeFilters}
            onChange={setFilters}
            projectOptions={projectOptions}
            memberOptions={
              showsEveryone
                ? (members ?? []).map((member) => ({ id: member.id, name: member.name ?? member.email }))
                : undefined
            }
            teamOptions={teams}
          />
          <SaveReportButton
            settings={
              <TimeActivityReportSettings
                range={range}
                showsEveryone={showsEveryone}
                grouping={grouping}
                filterCount={countReportFilters(activeFilters)}
              />
            }
            initialName={savedReport?.name}
            initialScheduled={savedReport?.scheduled}
            onSave={({ name, scheduled }) => {
              const id = saveReport({
                id: savedReport?.id,
                name,
                scheduled,
                settings: {
                  datePreset: preset,
                  days: { from: dateKeyInZone(range.from, zone), to: dateKeyInZone(range.to, zone) },
                  scope: showsEveryone ? "all" : "me",
                  grouping,
                  filters: activeFilters,
                },
              });
              if (!savedReport) router.push(`/organisations/${organisationId}/reports/saved/${id}`);
            }}
          />
        </div>
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
