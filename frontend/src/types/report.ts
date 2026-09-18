export type ReportGroupBy = "person" | "project";

export type ReportRow = {
  /** membershipId or projectId, depending on the request's groupBy. */
  key: string;
  label: string;
  seconds: number;
};

export type GetReportResult =
  | { ok: true; rows: ReportRow[] }
  | { ok: false; message: string };
