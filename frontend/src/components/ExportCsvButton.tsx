"use client";

import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { entriesToCsv } from "@/lib/entriesToCsv";
import type { TimeEntryListItem } from "@/types/timeEntry";

type ExportCsvButtonProps = {
  entries: TimeEntryListItem[];
  filename: string;
};

/** Downloads the entries currently shown in a timesheet view as a CSV file. */
export function ExportCsvButton({ entries, filename }: ExportCsvButtonProps) {
  function handleExport() {
    const blob = new Blob([entriesToCsv(entries)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={entries.length === 0}
      className="flex cursor-pointer items-center gap-1.5 rounded-md border border-input-border px-3 py-1.5 text-sm font-medium text-slate-900 transition-colors duration-150 hover:bg-cream disabled:cursor-not-allowed disabled:opacity-50"
    >
      <DownloadSimpleIcon size={16} aria-hidden="true" />
      Export CSV
    </button>
  );
}
