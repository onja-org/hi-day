import { DownloadSimpleIcon } from "@phosphor-icons/react";

type ImportTemplateButtonProps = {
  /** Builds the CSV on click, so it reflects the latest lookups. */
  buildCsv: () => string;
  filename: string;
};

/** Downloads a pre-filled CSV showing the import columns and example rows. */
export function ImportTemplateButton({ buildCsv, filename }: ImportTemplateButtonProps) {
  function handleDownload() {
    const blob = new Blob([buildCsv()], { type: "text/csv;charset=utf-8;" });
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
      onClick={handleDownload}
      className="flex w-fit cursor-pointer items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80"
    >
      <DownloadSimpleIcon size={16} aria-hidden="true" />
      Download template
    </button>
  );
}
