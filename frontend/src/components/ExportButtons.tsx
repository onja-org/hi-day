"use client";

import { useRef, useState } from "react";
import { CaretDownIcon, DownloadSimpleIcon } from "@phosphor-icons/react";
import { useDismissOnOutsideClick } from "@/hooks/useDismissOnOutsideClick";

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

/** One download control listing the formats on offer, rather than a button
 * per format — the choice is a detail of the same action, and a row of
 * buttons grows every time a format is added. */
export function ExportButtons({
  csv,
  buildPdf,
  filenameBase,
  disabled = false,
}: ExportButtonsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useDismissOnOutsideClick(containerRef, isOpen, () => setIsOpen(false));

  const formats = [
    csv !== undefined && {
      label: "CSV",
      download: () =>
        downloadBlob(
          new Blob([csv], { type: "text/csv;charset=utf-8;" }),
          `${filenameBase}.csv`,
        ),
    },
    buildPdf && {
      label: "PDF",
      download: () => downloadBlob(buildPdf(), `${filenameBase}.pdf`),
    },
  ].filter((format) => format !== false && format !== undefined);

  if (formats.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Export"
        className="flex h-11 cursor-pointer items-center gap-1.5 rounded-brand-sm border-2 border-ink px-3 text-sm font-semibold text-slate-900 transition-colors duration-150 hover:bg-cream disabled:cursor-not-allowed disabled:opacity-50"
      >
        <DownloadSimpleIcon size={16} aria-hidden="true" />
        Export
        <CaretDownIcon size={12} aria-hidden="true" />
      </button>

      {isOpen && (
        <ul
          role="menu"
          className="absolute top-full right-0 z-20 mt-1 w-40 rounded-brand-sm border-2 border-ink bg-white py-1 shadow-hard-sm"
        >
          {formats.map((format) => (
            <li key={format.label}>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  format.download();
                  setIsOpen(false);
                }}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-slate-900 hover:bg-cream"
              >
                <DownloadSimpleIcon size={16} aria-hidden="true" />
                Export {format.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
