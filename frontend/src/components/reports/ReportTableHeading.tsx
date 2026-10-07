import { timezoneLabel } from "@/lib/timezone";

type ReportTableHeadingProps = {
  organisationName: string | undefined;
  /** The zone the report's days are read in. */
  zone: string;
};

/** The organisation's name and the report's timezone. */
export function ReportTableHeading({ organisationName, zone }: ReportTableHeadingProps) {
  return (
    <h2 className="flex items-baseline gap-3">
      <span className="text-xl text-primary-dark">{organisationName}</span>
      <span className="text-xs text-slate-900/70">{timezoneLabel(zone)}</span>
    </h2>
  );
}
