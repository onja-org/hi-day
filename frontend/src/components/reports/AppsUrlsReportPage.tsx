"use client";

import { useState } from "react";
import { ErrorMessage } from "@/components/ErrorMessage";
import { ExportButtons } from "@/components/ExportButtons";
import { useAppsUrlsReportData } from "@/hooks/useAppsUrlsReportData";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { useProjects } from "@/hooks/useProjects";
import { useTimeActivityReportControls } from "@/hooks/useTimeActivityReportControls";
import { APPS_URLS_MAX_DAYS, appsUrlsColumns } from "@/lib/appsUrlsReportConfig";
import { buildAppsUrlsRows } from "@/lib/buildAppsUrlsRows";
import { buildReportTableAttachment } from "@/lib/buildReportTableAttachment";
import { collectAppsUrlsItems } from "@/lib/collectAppsUrlsItems";
import { filterAppsUrlsItems } from "@/lib/filterAppsUrlsItems";
import { listDayKeys } from "@/lib/listDayKeys";
import { reportFilenameBase } from "@/lib/reportFilenameBase";
import { reportTableToCsv } from "@/lib/reportTableToCsv";
import { sendReportFile } from "@/lib/sendReportFile";
import { dateKeyInZone } from "@/lib/timezone";
import type { AppsUrlsGrouping } from "@/types/appsUrlsReport";
import type { SendReportInput } from "@/types/sendReport";
import { AppsUrlsReportBody } from "./AppsUrlsReportBody";
import { ReportDateRangePicker } from "./ReportDateRangePicker";
import { ReportPageHeader } from "./ReportPageHeader";
import { ReportStatus } from "./ReportStatus";
import { SendReportButton } from "./SendReportButton";
import { TimeActivityFilter } from "./TimeActivityFilter";

type AppsUrlsReportPageProps = {
  organisationId: string;
};

/** Reuses the Time and activity report's date and filter controls over the Activity tabs' app and website data. */
export function AppsUrlsReportPage({ organisationId }: AppsUrlsReportPageProps) {
  const { preset, setPreset, filters, setFilters, setCustomDays, zone, range } = useTimeActivityReportControls();
  const [grouping, setGrouping] = useState<AppsUrlsGrouping>("date");
  const [search, setSearch] = useState("");
  const organisationQuery = useCurrentOrganisation();
  const projectsQuery = useProjects(organisationId, { status: "all" });
  const projects = projectsQuery.data ?? [];

  const dateKeys = listDayKeys(dateKeyInZone(range.from, zone), dateKeyInZone(range.to, zone));
  const tooLong = dateKeys.length > APPS_URLS_MAX_DAYS;
  const { appDays, urlDays, isLoading, error } = useAppsUrlsReportData(organisationId, dateKeys, !tooLong);

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

  return (
    <div className="flex flex-col gap-6">
      <ReportPageHeader organisationId={organisationId} title="Apps & URLs report" />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <ReportDateRangePicker
          id="apps-urls-date-range"
          range={range}
          preset={preset}
          zone={zone}
          setCustomDays={setCustomDays}
          setPreset={setPreset}
        />
        <TimeActivityFilter
          filters={filters}
          onChange={setFilters}
          projectOptions={projects.map((project) => ({ id: project.id, name: project.name }))}
        />
      </div>

      {tooLong && <ErrorMessage message={`Choose a date range of ${APPS_URLS_MAX_DAYS} days or fewer.`} />}
      <ReportStatus isLoading={isLoading} error={error} />
      {rows && (
        <AppsUrlsReportBody
          rows={rows}
          grouping={grouping}
          onGroupingChange={setGrouping}
          search={search}
          onSearchChange={setSearch}
          organisationName={organisationQuery.data?.name}
          zone={zone}
          actions={
            <>
              <ExportButtons
                csv={reportTableToCsv(columns, rows)}
                filenameBase={filenameBase}
                disabled={rows.length === 0}
              />
              <SendReportButton defaultSubject="Apps & URLs report" onSend={handleSend} />
            </>
          }
        />
      )}
    </div>
  );
}
