import type { ReactNode } from "react";
import { timezoneLabel } from "@/lib/timezone";

type ReportTableHeadingProps = {
  organisationName: string | undefined;
  /** The zone the report's days are read in. */
  zone: string;
  /** Export, send and schedule controls, shown beside the heading. */
  actions: ReactNode;
};

/** The organisation's name and the report's timezone, with the report's actions beside them. */
export function ReportTableHeading({ organisationName, zone, actions }: ReportTableHeadingProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-baseline gap-3">
        <span className="text-xl text-primary-dark">{organisationName}</span>
        <span className="text-xs text-slate-900/70">{timezoneLabel(zone)}</span>
      </h2>
      <div className="flex flex-wrap items-center gap-3">{actions}</div>
    </div>
  );
}
