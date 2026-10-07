import Link from "next/link";
import { CaretLeftIcon } from "@phosphor-icons/react";

type ReportPageHeaderProps = {
  organisationId: string;
  title: string;
};

/** The back link to All reports and the page's heading. */
export function ReportPageHeader({ organisationId, title }: ReportPageHeaderProps) {
  return (
    <header className="flex flex-col gap-2">
      <Link
        href={`/organisations/${organisationId}/reports/all`}
        className="flex w-fit items-center gap-1 text-sm text-primary hover:underline"
      >
        <CaretLeftIcon size={14} aria-hidden="true" />
        Reports
      </Link>
      <h1 className="text-2xl font-semibold text-primary-dark">{title}</h1>
    </header>
  );
}
