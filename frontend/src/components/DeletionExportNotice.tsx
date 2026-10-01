import Link from "next/link";
import { ArrowSquareOutIcon } from "@phosphor-icons/react";

type DeletionExportNoticeProps = {
  organisationId: number;
};

/**
 * There's no full-organisation export yet, so these open the pages whose
 * own CSV/PDF export buttons hold the real reports.
 */
export function DeletionExportNotice({
  organisationId,
}: DeletionExportNoticeProps) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-input-border bg-cream/60 p-3">
      <div className="flex flex-col">
        <h3 className="text-sm font-medium text-primary-dark">
          Save what you want to keep first
        </h3>
        <p className="text-xs text-slate-900/70">
          There&rsquo;s no one-click export of the whole organisation yet. Open a
          report, then use its Export CSV or PDF button.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/organisations/${organisationId}/time_entries`}
          target="_blank"
          className="flex h-9 items-center gap-1.5 rounded-md border border-input-border bg-white px-3 text-sm font-medium text-slate-900 transition-colors duration-150 hover:bg-cream"
        >
          <ArrowSquareOutIcon size={16} aria-hidden="true" />
          Open time entries
        </Link>
        <Link
          href={`/organisations/${organisationId}/activities`}
          target="_blank"
          className="flex h-9 items-center gap-1.5 rounded-md border border-input-border bg-white px-3 text-sm font-medium text-slate-900 transition-colors duration-150 hover:bg-cream"
        >
          <ArrowSquareOutIcon size={16} aria-hidden="true" />
          Open activity
        </Link>
      </div>
    </section>
  );
}
