"use client";

import { useState } from "react";
import { ClockIcon, FunnelIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { format } from "date-fns";
import { useActiveMembers } from "@/hooks/useActiveMembers";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { useMyProfile } from "@/hooks/useMyProfile";
import { useMyProjects } from "@/hooks/useMyProjects";
import { useReportTimezone } from "@/hooks/useReportTimezone";
import { useViewerTimezone } from "@/hooks/useViewerTimezone";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { entriesToCsv } from "@/lib/entriesToCsv";
import type { TimezoneSource } from "@/lib/timezone";
import {
  EMPTY_TIMESHEET_FILTERS,
  countActiveFilters,
  filterTimeEntries,
  projectFilterOptions,
} from "@/lib/timesheetFilters";
import type { TimesheetFilters } from "@/lib/timesheetFilters";
import { getTimesheetDateRange } from "@/lib/getTimesheetDateRange";
import { getWeekRange } from "@/lib/getWeekRange";
import type { DateRange, DateRangePreset } from "@/types/dateRange";
import { ErrorMessage } from "@/components/ErrorMessage";
import { ExportButtons } from "@/components/ExportButtons";
import { Spinner } from "@/components/Spinner";
import { TimeEntryFormModal } from "@/components/TimeEntryFormModal";
import { TimesheetCalendarGrid } from "@/components/TimesheetCalendarGrid";
import { TimesheetDailyView } from "@/components/TimesheetDailyView";
import { TimesheetFilterPanel } from "@/components/TimesheetFilterPanel";
import { TimesheetWeeklyMatrix } from "@/components/TimesheetWeeklyMatrix";
import { WeekNavigator } from "@/components/WeekNavigator";
import { SearchableSelect } from "@/components/SearchableSelect";
import { memberOptions } from "@/components/TimesheetFilterPanel";
import { TimezoneSelect } from "@/components/TimezoneSelect";
import type { TimezoneOption } from "@/components/TimezoneSelect";

type TimeEntriesPageContentProps = {
  organisationId: string;
};

type TimesheetViewMode = "daily" | "weekly" | "calendar";

const VIEW_MODE_LABELS: Record<TimesheetViewMode, string> = {
  daily: "Daily",
  weekly: "Weekly",
  calendar: "Calendar",
};

const DEFAULT_DATE_PRESET: DateRangePreset = "last_7_days";

export function TimeEntriesPageContent({
  organisationId,
}: TimeEntriesPageContentProps) {
  const [addingTime, setAddingTime] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  // Which of the three zones the timesheet is *read* in. Never changes a
  // stored entry — only the clock it is shown against.
  const [timezoneSource, setTimezoneSource] = useState<TimezoneSource>("viewer");
  const [filters, setFilters] = useState<TimesheetFilters>(EMPTY_TIMESHEET_FILTERS);
  // "" means "my own timesheet" — the default for everyone, including
  // admins/managers.
  const [viewingMembershipId, setViewingMembershipId] = useState("");
  const [viewMode, setViewMode] = useState<TimesheetViewMode>("daily");
  const [datePreset, setDatePreset] = useState<DateRangePreset | null>(
    DEFAULT_DATE_PRESET,
  );
  const [customRange, setCustomRange] = useState<DateRange>(() =>
    getTimesheetDateRange(DEFAULT_DATE_PRESET),
  );
  const [weekOffset, setWeekOffset] = useState(0);

  const organisationQuery = useCurrentOrganisation();
  const canViewOthers =
    organisationQuery.data?.role === "admin" || organisationQuery.data?.role === "manager";
  const isAdmin = organisationQuery.data?.role === "admin";
  const membersQuery = useActiveMembers(organisationId);
  const profileQuery = useMyProfile();
  useReportTimezone(profileQuery.data?.timezone);
  const myProjectsQuery = useMyProjects(organisationId);
  const ownLabel = profileQuery.data?.name ?? profileQuery.data?.email ?? "Me";
  const otherMembers = (membersQuery.data ?? []).filter(
    (member) => member.userId !== organisationQuery.data?.userId,
  );

  const isOwnTimesheet = viewingMembershipId === "";
  const membershipId = isOwnTimesheet ? undefined : viewingMembershipId;
  // From the browser rather than their stored value: it is where they are
  // right now, which is what "my time zone" means. Null until hydration —
  // the server's zone is not theirs.
  const viewerZone = useViewerTimezone();
  const viewedMember = otherMembers.find(
    (member) => member.id === viewingMembershipId,
  );
  const timezoneOptions: TimezoneOption[] = [
    {
      source: "member",
      heading: "Member's time zone",
      // Viewing your own timesheet makes the member you — no separate zone
      // to offer, and none to be missing.
      zone: isOwnTimesheet
        ? viewerZone
        : (viewedMember?.timezone ?? null),
    },
    { source: "viewer", heading: "My time zone", zone: viewerZone },
    {
      source: "organisation",
      heading: organisationQuery.data?.name ?? "Organisation",
      zone: organisationQuery.data?.timezone ?? null,
    },
  ];
  // Switching to a member who has never signed in would otherwise leave the
  // selector pointing at a source with no zone — showing their name while
  // reading the viewer's clock. Falling back to "viewer" keeps the label and
  // the times telling the same story.
  const activeSource: TimezoneSource =
    timezoneOptions.find((option) => option.source === timezoneSource)?.zone ==
    null
      ? "viewer"
      : timezoneSource;
  // UTC is only ever reached before hydration, when no entries are on screen.
  const activeZone =
    timezoneOptions.find((option) => option.source === activeSource)?.zone ??
    "UTC";


  const dailyRange = datePreset
    ? getTimesheetDateRange(datePreset, new Date(), activeZone)
    : customRange;
  const dailyEntriesQuery = useTimeEntries(
    organisationId,
    { membershipId, from: dailyRange.from, to: dailyRange.to },
    { enabled: viewMode === "daily" },
  );

  const now = new Date();
  const { start: weekStart, end: weekEnd } = getWeekRange(
    now,
    weekOffset,
    activeZone,
  );
  const weekEntriesQuery = useTimeEntries(
    organisationId,
    { membershipId, from: weekStart, to: weekEnd },
    { enabled: viewMode === "weekly" || viewMode === "calendar" },
  );

  // Filtering happens here rather than per view, so the Daily, Weekly and
  // Calendar tabs can't disagree about what is on screen — and so the CSV
  // export carries exactly what the page shows.
  const dailyEntries = dailyEntriesQuery.data
    ? filterTimeEntries(dailyEntriesQuery.data, filters)
    : undefined;
  const weekEntries = weekEntriesQuery.data
    ? filterTimeEntries(weekEntriesQuery.data, filters)
    : undefined;

  // Built from the *unfiltered* entries, so narrowing to one project does
  // not make the others vanish from the picker.
  const projectOptions = projectFilterOptions(
    myProjectsQuery.data ?? [],
    (viewMode === "daily" ? dailyEntriesQuery.data : weekEntriesQuery.data) ?? [],
  );
  const activeFilterCount = countActiveFilters(filters);


  const activeEntries = viewMode === "daily" ? dailyEntries : weekEntries;
  const activeFilenameBase =
    viewMode === "daily"
      ? `timesheet-${format(dailyRange.from, "yyyy-MM-dd")}-to-${format(dailyRange.to, "yyyy-MM-dd")}`
      : `timesheet-${viewMode}-${weekStart.toISOString().slice(0, 10)}`;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-white">
            <ClockIcon size={18} aria-hidden="true" />
          </span>
          <h1 className="text-2xl font-semibold text-primary-dark">
            Timesheets
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Kept alongside the drawer's own member filter, not replaced by
              it: switching whose timesheet you are looking at is the most
              frequent move on this page, and it changes which entries are
              fetched rather than which are shown. Both bind to the same
              state, so they can never disagree. */}
          {canViewOthers && membersQuery.data && (
            <SearchableSelect
              ariaLabel="Whose timesheet to view"
              value={viewingMembershipId}
              onChange={setViewingMembershipId}
              options={memberOptions(ownLabel, otherMembers)}
              placeholder="Search members"
              noMatchesLabel="No members match"
            />
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setAddingTime(true)}
              className="cursor-pointer rounded-md bg-primary px-4 py-2 text-white transition-colors duration-150 hover:bg-primary/90"
            >
              Add time
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            aria-expanded={showFilters}
            className="flex h-11 cursor-pointer items-center gap-2 rounded-md border border-input-border px-4 text-sm font-medium text-slate-900 transition-colors duration-150 hover:border-primary hover:text-primary"
          >
            <FunnelIcon size={16} aria-hidden="true" />
            Filters
            {activeFilterCount > 0 && (
              <span className="tabular-nums">({activeFilterCount})</span>
            )}
          </button>
          <ExportButtons
            csv={entriesToCsv(activeEntries ?? [], activeZone)}
            filenameBase={activeFilenameBase}
            disabled={(activeEntries ?? []).length === 0}
          />
        </div>
      </div>

      <nav
        role="tablist"
        aria-label="View mode"
        className="flex gap-1 border-b border-input-border"
      >
        {Object.entries(VIEW_MODE_LABELS).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={viewMode === value}
            onClick={() => setViewMode(value as TimesheetViewMode)}
            className={clsx(
              "cursor-pointer border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-150",
              viewMode === value
                ? "border-primary text-primary"
                : "border-transparent text-slate-900 hover:text-primary-dark",
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      {viewMode === "daily" && (
        <TimesheetDailyView
          organisationId={organisationId}
          zone={activeZone}
          timezoneSelect={
            <TimezoneSelect
              options={timezoneOptions}
              value={activeSource}
              onChange={setTimezoneSource}
            />
          }
          isOwnTimesheet={isOwnTimesheet}
          datePreset={datePreset}
          defaultDatePreset={DEFAULT_DATE_PRESET}
          range={dailyRange}
          onDateRangeChange={(range, preset) => {
            setCustomRange(range);
            setDatePreset(preset);
          }}
          entries={dailyEntries}
          isLoading={dailyEntriesQuery.isLoading}
          isError={dailyEntriesQuery.isError}
          errorMessage={
            dailyEntriesQuery.error instanceof Error
              ? dailyEntriesQuery.error.message
              : undefined
          }
        />
      )}

      {(viewMode === "weekly" || viewMode === "calendar") && (
        <div className="flex flex-col gap-3">
          <WeekNavigator
            label="Week"
            weekOffset={weekOffset}
            onChange={setWeekOffset}
          />

          {weekEntriesQuery.isLoading && (
            <p className="flex items-center gap-2 text-slate-900">
              <Spinner className="text-primary-dark" />
              Loading timesheet…
            </p>
          )}

          {weekEntriesQuery.isError && (
            <ErrorMessage message="Could not load this timesheet." />
          )}

          {weekEntries && viewMode === "weekly" && (
            <TimesheetWeeklyMatrix
              entries={weekEntries}
              start={weekStart}
              zone={activeZone}
            />
          )}

          {weekEntries && viewMode === "calendar" && (
            <TimesheetCalendarGrid
              organisationId={organisationId}
              entries={weekEntries}
              zone={activeZone}
              start={weekStart}
              now={now}
            />
          )}
        </div>
      )}

      {showFilters && (
        <TimesheetFilterPanel
          filters={filters}
          onChange={setFilters}
          projectOptions={projectOptions}
          memberValue={viewingMembershipId}
          onMemberChange={setViewingMembershipId}
          ownLabel={ownLabel}
          otherMembers={otherMembers}
          canViewOthers={canViewOthers && membersQuery.data !== undefined}
          onClose={() => setShowFilters(false)}
        />
      )}

      {addingTime && (
        <TimeEntryFormModal
          organisationId={organisationId}
          forMembershipId={membershipId}
          onClose={() => setAddingTime(false)}
        />
      )}
    </div>
  );
}
