"use client";

import { useMemo, useState } from "react";
import { ErrorMessage } from "@/components/ErrorMessage";
import { ExportButtons } from "@/components/ExportButtons";
import { useAppsUrlsReportData } from "@/hooks/useAppsUrlsReportData";
import { useActiveMembers } from "@/hooks/useActiveMembers";
import { useCanViewOthers } from "@/hooks/useCanViewOthers";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { useMyProfile } from "@/hooks/useMyProfile";
import { useProjects } from "@/hooks/useProjects";
import { useSavedReportPersist } from "@/hooks/useSavedReportPersist";
import { useTimeActivityReportControls } from "@/hooks/useTimeActivityReportControls";
import { APPS_URLS_GROUPINGS, APPS_URLS_MAX_DAYS, APPS_URLS_MAX_MEMBER_DAYS, appsUrlsColumns } from "@/lib/appsUrlsReportConfig";
import { buildAppsUrlsRows } from "@/lib/buildAppsUrlsRows";
import { buildReportTableAttachment } from "@/lib/buildReportTableAttachment";
import { collectAppsUrlsItems } from "@/lib/collectAppsUrlsItems";
import { filterAppsUrlsItems } from "@/lib/filterAppsUrlsItems";
import { listDayKeys } from "@/lib/listDayKeys";
import { reportFilenameBase } from "@/lib/reportFilenameBase";
import { reportTableToCsv } from "@/lib/reportTableToCsv";
import { sendReportFile } from "@/lib/sendReportFile";
import { dateKeyInZone } from "@/lib/timezone";
import type { AppsUrlsGrouping, AppsUrlsMember } from "@/types/appsUrlsReport";
import type { SavedReport } from "@/types/savedReport";
import type { SendReportInput } from "@/types/sendReport";
import { AppsUrlsReportBody } from "./AppsUrlsReportBody";
import { ReportDateRangePicker } from "./ReportDateRangePicker";
import { ReportPageHeader } from "./ReportPageHeader";
import { ReportScopeTabs } from "./ReportScopeTabs";
import { ReportStatus } from "./ReportStatus";
import { ReportTableHeading } from "./ReportTableHeading";
import { ScheduleReportButton } from "./ScheduleReportButton";
import { ScheduleReportDialog } from "./ScheduleReportDialog";
import { SendReportButton } from "./SendReportButton";
import { TimeActivityFilter } from "./TimeActivityFilter";

type AppsUrlsReportPageProps = {
  organisationId: string;
  /** Set when a saved report is opened: restores its settings and updates it on Schedule. */
  savedReport?: SavedReport;
};

/** Saved reports store the date grouping as "day", like the other reports. */
const SAVED_GROUPINGS: Record<AppsUrlsGrouping, "day" | "project" | "member"> = {
  date: "day",
  project: "project",
  member: "member",
};

/** Reuses the Time and activity report's date and filter controls over the Activity tabs' app and website data. */
export function AppsUrlsReportPage({ organisationId, savedReport }: AppsUrlsReportPageProps) {
  const { scope, setScope, preset, setPreset, filters, setFilters, setCustomDays, zone, range } =
    useTimeActivityReportControls(
      savedReport?.settings,
    );
  const [grouping, setGrouping] = useState<AppsUrlsGrouping>(
    () => APPS_URLS_GROUPINGS.find((option) => SAVED_GROUPINGS[option.value] === savedReport?.settings.grouping)?.value ?? "date",
  );
  const [scheduling, setScheduling] = useState(false);
  const [search, setSearch] = useState("");
  const organisationQuery = useCurrentOrganisation();
  const projectsQuery = useProjects(organisationId, { status: "all" });
  const projects = projectsQuery.data ?? [];
  const profile = useMyProfile().data;
  const canViewOthers = useCanViewOthers();
  const isAll = canViewOthers && scope === "all";
  const membersQuery = useActiveMembers(organisationId, { enabled: isAll });

  const myName = profile?.name ?? profile?.email ?? "-";
  const members = useMemo<AppsUrlsMember[]>(
    () =>
      isAll
        ? (membersQuery.data ?? []).map((member) => ({
            key: member.id,
            membershipId: member.id,
            name: member.name ?? member.email,
          }))
        : [{ key: "me", membershipId: undefined, name: myName }],
    [isAll, membersQuery.data, myName],
  );

  const dateKeys = listDayKeys(dateKeyInZone(range.from, zone), dateKeyInZone(range.to, zone));
  const tooLong = dateKeys.length > APPS_URLS_MAX_DAYS || (isAll && dateKeys.length * members.length > APPS_URLS_MAX_MEMBER_DAYS);
  const { appDays, urlDays, isLoading, error } = useAppsUrlsReportData(
    organisationId,
    dateKeys,
    members,
    !tooLong && !(isAll && membersQuery.isLoading),
  );

  const items =
    appDays && urlDays
      ? filterAppsUrlsItems(collectAppsUrlsItems(appDays, urlDays, projects), filters.projectIds, search)
      : undefined;
  const rows = items ? buildAppsUrlsRows(items, grouping) : undefined;
  const columns = appsUrlsColumns(grouping);
  const filenameBase = reportFilenameBase("apps-and-urls", range);

  function handleSend(input: SendReportInput): Promise<string | void> {
    return sendReportFile({
      organisationId,
      input,
      filenameBase,
      isEmpty: !rows || rows.length === 0,
      buildContent: (fileType, title) => buildReportTableAttachment(fileType, columns, rows ?? [], title),
    });
  }

  const persist = useSavedReportPersist(
    organisationId,
    savedReport,
    { preset, range, zone, scope: isAll ? "all" : "me", grouping: SAVED_GROUPINGS[grouping], filters },
    "apps-and-urls",
  );

  return (
    <div className="flex flex-col gap-6">
      <ReportPageHeader
        organisationId={organisationId}
        title={`Apps & URLs report${savedReport ? ` - ${savedReport.name}` : ""}`}
      />

      <ReportTableHeading organisationName={organisationQuery.data?.name} zone={zone} />

      {canViewOthers && <ReportScopeTabs value={scope} onChange={setScope} />}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <ReportDateRangePicker
          id="apps-urls-date-range"
          range={range}
          preset={preset}
          zone={zone}
          setCustomDays={setCustomDays}
          setPreset={setPreset}
        />
        <div className="flex flex-wrap items-center gap-3">
          <ExportButtons
            csv={rows ? reportTableToCsv(columns, rows) : ""}
            filenameBase={filenameBase}
            disabled={!rows || rows.length === 0}
          />
          <SendReportButton
            defaultSubject={`Apps & URLs report${savedReport ? ` - ${savedReport.name}` : ""}`}
            onSend={handleSend}
          />
          <ScheduleReportButton onClick={() => setScheduling(true)} />
          <TimeActivityFilter
            filters={filters}
            onChange={setFilters}
            projectOptions={projects.map((project) => ({ id: project.id, name: project.name }))}
          />
        </div>
      </div>

      {scheduling && (
        <ScheduleReportDialog
          initialName={savedReport?.name ?? ""}
          initialSchedule={savedReport?.schedule ?? undefined}
          onPersist={persist}
          onClose={() => setScheduling(false)}
        />
      )}

      {tooLong && <ErrorMessage message={
            isAll
              ? "Choose a shorter date range: the All tab fetches every member's days."
              : `Choose a date range of ${APPS_URLS_MAX_DAYS} days or fewer.`
          } />}
      <ReportStatus isLoading={isLoading || (isAll && membersQuery.isLoading)} error={error ?? membersQuery.error} />
      {rows && (
        <AppsUrlsReportBody
          rows={rows}
          grouping={grouping}
          onGroupingChange={setGrouping}
          search={search}
          onSearchChange={setSearch}
        />
      )}
    </div>
  );
}
