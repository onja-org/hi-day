import { API_URL } from "./apiUrl";
import type { GetReportResult, ReportGroupBy } from "@/types/report";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export type GetReportFilter = {
  groupBy: ReportGroupBy;
  from: Date;
  to: Date;
};

export async function getReport(
  organisationId: string,
  filter: GetReportFilter,
): Promise<GetReportResult> {
  const params = new URLSearchParams({
    groupBy: filter.groupBy,
    from: filter.from.toISOString(),
    to: filter.to.toISOString(),
  });

  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/reports?${params.toString()}`,
      { method: "GET", credentials: "include" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const rows = await response.json();
    return { ok: true, rows };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
