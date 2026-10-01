"use client";

import { useState } from "react";
import { useFavouriteReports } from "@/hooks/useFavouriteReports";
import { filterReports } from "@/lib/filterReports";
import { REPORT_SECTIONS, REPORTS } from "@/lib/reportCatalog";
import { ReportsCard } from "./ReportsCard";
import { ReportsSection } from "./ReportsSection";

type AllReportsPageContentProps = {
  organisationId: number;
};

export function AllReportsPageContent({ organisationId }: AllReportsPageContentProps) {
  const [query, setQuery] = useState("");
  const { favouriteIds, toggleFavourite } = useFavouriteReports(organisationId);
  const visibleReports = filterReports(REPORTS, query);

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
          className="w-full rounded-full border border-input-border bg-white px-4 py-2 text-sm text-slate-900 sm:w-64"
        />
      </div>

      <ReportsSection title="Customised reports">
        <p className="rounded-lg border border-input-border bg-white p-6 text-center text-sm text-slate-900/70">
          No customised reports yet.
        </p>
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
    </div>
  );
}
