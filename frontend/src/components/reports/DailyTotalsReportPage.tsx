"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaretLeftIcon } from "@phosphor-icons/react";
import { format } from "date-fns";
import { DateRangePicker } from "@/components/DateRangePicker";
import { ErrorMessage } from "@/components/ErrorMessage";
import { ExportButtons } from "@/components/ExportButtons";
import { Spinner } from "@/components/Spinner";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { useModalSubmit } from "@/hooks/useModalSubmit";
import { useSavedReports } from "@/hooks/useSavedReports";
import { useTimeActivityReportControls, DEFAULT_TIME_ACTIVITY_PRESET } from "@/hooks/useTimeActivityReportControls";
import { useTimeActivityReportData } from "@/hooks/useTimeActivityReportData";
import { buildDailyTotalsAttachment } from "@/lib/buildDailyTotalsAttachment";
import { buildDailyTotalsReport } from "@/lib/buildDailyTotalsReport";
import { dailyTotalsToCsv } from "@/lib/dailyTotalsToCsv";
import { sendReport } from "@/lib/sendReport";
import { dateKeyInZone } from "@/lib/timezone";
import type { ReportSchedule } from "@/types/reportSchedule";
import type { SavedReport } from "@/types/savedReport";
import type { SendReportInput } from "@/types/sendReport";
import { DailyTotalsReportBody } from "./DailyTotalsReportBody";
import { ReportScopeTabs } from "./ReportScopeTabs";
import { ScheduleReportButton } from "./ScheduleReportButton";
import { ScheduleReportModal } from "./ScheduleReportModal";
import { SendReportButton } from "./SendReportButton";
import { TimeActivityFilter } from "./TimeActivityFilter";

type DailyTotalsReportPageProps = {
  organisationId: string;
  /** Set when a saved report is opened: restores its settings and updates it on Schedule. */
  savedReport?: SavedReport;
};

/** Reuses the Time and activity report's controls and data, shown as a project-by-day grid. */
export function DailyTotalsReportPage({ organisationId, savedReport }: DailyTotalsReportPageProps) {
  const router = useRouter();
  const organisationQuery = useCurrentOrganisation();
  const { saveReport } = useSavedReports(organisationId);
  const [scheduling, setScheduling] = useState(false);
  const scheduleSubmit = useModalSubmit();
  const { scope, setScope, preset, setPreset, filters, setFilters, setCustomDays, zone, range } =
    useTimeActivityReportControls(savedReport?.settings);
  const { canViewOthers, activeFilters, projectOptions, entries, isLoading, error } = useTimeActivityReportData(
    organisationId,
    scope,
    range,
    filters,
  );
  const report = entries ? buildDailyTotalsReport(entries, range) : undefined;
  const filenameBase = `daily-totals-${format(range.from, "yyyy-MM-dd")}-to-${format(range.to, "yyyy-MM-dd")}`;

  // Builds the file the way the report currently looks, then has the
  // backend email it. Resolves with a message on failure, nothing on success.
  async function handleSend(input: SendReportInput): Promise<string | void> {
    if (!report || report.rows.length === 0) return "There's nothing to send for this date range.";
    try {
      const contentBase64 = await buildDailyTotalsAttachment(input.fileType, report, input.subject);
      const result = await sendReport(organisationId, {
        ...input,
        filename: `${filenameBase}.${input.fileType}`,
        contentBase64,
      });
      if (!result.ok) return result.message;
    } catch {
      return "The report file could not be built. Please try again.";
    }
  }

  function closeSchedule() {
    setScheduling(false);
    scheduleSubmit.reset();
  }

  // Saves (or, on an already-saved report, updates) this report with its
  // schedule; a brand-new one then opens at its own address. Resolves with
  // a message when it couldn't be saved.
  async function persist(input: { name: string; schedule: ReportSchedule }): Promise<string | void> {
    const result = await saveReport({
      id: savedReport?.id,
      reportType: "daily-totals",
      ...input,
      settings: {
        datePreset: preset,
        days: { from: dateKeyInZone(range.from, zone), to: dateKeyInZone(range.to, zone) },
        scope: scope === "all" && canViewOthers ? "all" : "me",
        grouping: "day",
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
        <h1 className="text-2xl font-semibold text-primary-dark">Daily totals report (Weekly){savedReport && ` - ${savedReport.name}`}</h1>
      </header>

      {canViewOthers && <ReportScopeTabs value={scope} onChange={setScope} />}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <DateRangePicker
          id="daily-totals-date-range"
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
        <TimeActivityFilter filters={activeFilters} onChange={setFilters} projectOptions={projectOptions} />
      </div>

      {scheduling && (
        <ScheduleReportModal
          initialName={savedReport?.name ?? ""}
          initialSchedule={savedReport?.schedule ?? undefined}
          isPending={scheduleSubmit.isPending}
          errorMessage={scheduleSubmit.errorMessage}
          onClose={closeSchedule}
          onSchedule={async ({ name, ...schedule }) => {
            if (await scheduleSubmit.submit(() => persist({ name, schedule }))) closeSchedule();
          }}
        />
      )}

      {isLoading && (
        <p className="flex items-center gap-2 text-slate-900">
          <Spinner className="text-primary-dark" />
          Loading report…
        </p>
      )}
      {error && <ErrorMessage message={error.message} />}
      {entries && report && (
        <DailyTotalsReportBody
          report={report}
          organisationName={organisationQuery.data?.name}
          zone={zone}
          actions={
            <>
              <ExportButtons
                csv={dailyTotalsToCsv(report)}
                filenameBase={filenameBase}
                disabled={report.rows.length === 0}
              />
              <SendReportButton
                defaultSubject={`Daily totals report${savedReport ? ` - ${savedReport.name}` : ""}`}
                onSend={handleSend}
              />
              <ScheduleReportButton onClick={() => setScheduling(true)} />
            </>
          }
        />
      )}
    </div>
  );
}
