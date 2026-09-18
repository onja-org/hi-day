"use client";

import { ReportsTable } from "./ReportsTable";
import { RequireRole } from "./RequireRole";

type ReportsPageContentProps = {
  organisationId: string;
};

export function ReportsPageContent({ organisationId }: ReportsPageContentProps) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-primary-dark">Reports</h1>

      <RequireRole role={["admin", "manager"]}>
        <ReportsTable organisationId={organisationId} />
      </RequireRole>
    </div>
  );
}
