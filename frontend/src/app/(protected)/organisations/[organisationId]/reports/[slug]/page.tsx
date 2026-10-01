import Link from "next/link";
import { notFound } from "next/navigation";
import { REPORTS } from "@/lib/reportCatalog";

type ReportPageProps = {
  params: Promise<{ organisationId: string; slug: string }>;
};

/** Placeholder until each report's real page exists, so a favourited report's
 * sidebar link doesn't dead-end on a 404. */
export default async function ReportPage({ params }: ReportPageProps) {
  const { organisationId, slug } = await params;
  const report = REPORTS.find((candidate) => candidate.id === slug);
  if (!report) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-primary-dark">{report.title}</h1>
      <p className="text-sm text-slate-900/70">{report.description}</p>
      <p className="text-sm text-slate-900">This report is coming soon.</p>
      <Link
        href={`/organisations/${organisationId}/reports/all`}
        className="text-sm font-medium text-primary hover:underline"
      >
        Back to all reports
      </Link>
    </div>
  );
}
