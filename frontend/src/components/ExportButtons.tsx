"use client";

import { DownloadSimpleIcon } from "@phosphor-icons/react";

type ExportButtonsProps = {
  csv?: string;
  buildPdf?: () => Blob;
  filenameBase: string;
  disabled?: boolean;
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ExportButtons({
  csv,
  buildPdf,
  filenameBase,
  disabled = false,
}: ExportButtonsProps) {
  return (
    <div className="flex items-center gap-2">
      {csv !== undefined && (
        <button
          type="button"
          onClick={() =>
            downloadBlob(
              new Blob([csv], { type: "text/csv;charset=utf-8;" }),
              `${filenameBase}.csv`,
            )
          }
          disabled={disabled}
          className="flex h-11 cursor-pointer items-center gap-1.5 rounded-md border border-input-border px-3 text-sm font-medium text-slate-900 transition-colors duration-150 hover:bg-cream disabled:cursor-not-allowed disabled:opacity-50"
        >
          <DownloadSimpleIcon size={16} aria-hidden="true" />
          Export CSV
        </button>
      )}
      {buildPdf && (
        <button
          type="button"
          onClick={() => downloadBlob(buildPdf(), `${filenameBase}.pdf`)}
          disabled={disabled}
          className="flex h-11 cursor-pointer items-center gap-1.5 rounded-md border border-input-border px-3 text-sm font-medium text-slate-900 transition-colors duration-150 hover:bg-cream disabled:cursor-not-allowed disabled:opacity-50"
        >
          <DownloadSimpleIcon size={16} aria-hidden="true" />
          Export PDF
        </button>
      )}
    </div>
  );
}
