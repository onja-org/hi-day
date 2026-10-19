"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorMessage } from "@/components/ErrorMessage";
import { useFavouriteReports } from "@/hooks/useFavouriteReports";
import { useSavedReports } from "@/hooks/useSavedReports";
import { useProjectsEnabled } from "@/hooks/useProjectsEnabled";
import { filterReports } from "@/lib/filterReports";
import { REPORT_SECTIONS, reportsFor } from "@/lib/reportCatalog";
import { ReportsCard } from "./ReportsCard";
import { ReportsSection } from "./ReportsSection";
import { SavedReportCard } from "./SavedReportCard";
import type { SavedReport } from "@/types/savedReport";

type AllReportsPageContentProps = {
  organisationId: number;
};

export function AllReportsPageContent({ organisationId }: AllReportsPageContentProps) {
  const projectsEnabled = useProjectsEnabled();
  const [query, setQuery] = useState("");
  const { favouriteIds, toggleFavourite } = useFavouriteReports(organisationId);
  const { reports: savedReports, deleteReport } = useSavedReports(String(organisationId));
  const [deleting, setDeleting] = useState<SavedReport | null>(null);
  const [deleteError, setDeleteError] = useState<string | undefined>();
  const visibleReports = filterReports(reportsFor(projectsEnabled), query);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-primary-dark">Reports</h1>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search reports"
          placeholder="Search reports"
          className="w-full rounded-full border-2 border-ink bg-white px-4 py-2 text-sm text-slate-900 sm:w-64"
        />
      </div>

      <ReportsSection title="Customised reports">
        {savedReports.length === 0 ? (
          <p className="rounded-lg border border-input-border bg-white p-6 text-center text-sm text-slate-900/70">
            No customised reports yet.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {savedReports.map((saved) => (
              <li key={saved.id}>
                <SavedReportCard
                  report={saved}
                  href={`/organisations/${organisationId}/reports/saved/${saved.id}`}
                  isFavourite={favouriteIds.includes(saved.id)}
                  onToggleFavourite={() => toggleFavourite(saved.id)}
                  onDelete={() => setDeleting(saved)}
                />
              </li>
            ))}
          </ul>
        )}
        {deleteError && <ErrorMessage message={deleteError} />}
      </ReportsSection>

      {visibleReports.length === 0 && (
        <p className="text-sm text-slate-900/70">No reports match “{query.trim()}”.</p>
      )}

      {REPORT_SECTIONS.map((section) => {
        const reports = visibleReports.filter((report) => report.section === section.id);
        if (reports.length === 0) return null;
        return (
          <ReportsSection key={section.id} title={section.label}>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {reports.map((report) => (
                <li key={report.id}>
                  <ReportsCard
                    title={report.title}
                    description={report.description}
                    badge={report.badge}
                    featured={section.id === "popular"}
                    href={`/organisations/${organisationId}/reports/${report.id}`}
                    isFavourite={favouriteIds.includes(report.id)}
                    onToggleFavourite={() => toggleFavourite(report.id)}
                  />
                </li>
              ))}
            </ul>
          </ReportsSection>
        );
      })}

      {deleting && (
        <ConfirmDialog
          title="Delete saved report"
          message={`Delete “${deleting.name}”? This can't be undone.`}
          confirmLabel="Delete"
          isDangerous
          onConfirm={async () => {
            const result = await deleteReport(deleting.id);
            if (result.ok) {
              setDeleting(null);
              setDeleteError(undefined);
            } else setDeleteError(result.message);
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
