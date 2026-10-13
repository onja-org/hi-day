"use client";

import { SelectField } from "@/components/ui/form/SelectField";
import { useSavedReportPersist } from "@/hooks/useSavedReportPersist";
import { useTimeActivityReportControls } from "@/hooks/useTimeActivityReportControls";
import { useTimeActivityReportData } from "@/hooks/useTimeActivityReportData";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { timezoneAbbreviation, timezoneTooltip } from "@/lib/timezone";
import { TIME_ACTIVITY_GROUPINGS } from "@/lib/timeActivityReportConfig";
import type { SavedReport } from "@/types/savedReport";
import type { TimeActivityGrouping } from "@/types/timeActivityGrouping";
import { ReportDateRangePicker } from "./ReportDateRangePicker";
import { ReportPageHeader } from "./ReportPageHeader";
import { ReportScopeTabs } from "./ReportScopeTabs";
import { ReportStatus } from "./ReportStatus";
import { TimeActivityReportActions } from "./TimeActivityReportActions";
import { TimeActivityReportBody } from "./TimeActivityReportBody";

type TimeActivityReportPageProps = {
  organisationId: string;
  /** Set when a saved report is opened: restores its settings and updates it on Save. */
  savedReport?: SavedReport;
};

export function TimeActivityReportPage({ organisationId, savedReport }: TimeActivityReportPageProps) {
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

  const persist = useSavedReportPersist(organisationId, savedReport, {
    preset,
    range,
    zone,
    scope: showsEveryone ? "all" : "me",
    grouping,
    filters: activeFilters,
  });

  return (
    <div className="flex flex-col gap-6">
      <ReportPageHeader
        organisationId={organisationId}
        title={`Time and activity report${savedReport ? ` - ${savedReport.name}` : ""}`}
      />

      {canViewOthers && <ReportScopeTabs value={scope} onChange={setScope} />}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <ReportDateRangePicker
            id="time-activity-date-range"
            range={range}
            preset={preset}
            zone={zone}
            setCustomDays={setCustomDays}
            setPreset={setPreset}
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

      <ReportStatus isLoading={isLoading || organisationQuery.isLoading} error={error} />
      {entries && <TimeActivityReportBody entries={entries} grouping={grouping} teamNames={teamNames} idleMembers={idleMembers} zone={zone} />}
    </div>
  );
}
