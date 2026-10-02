export type ReportChartSeries = {
  key: string;
  label: string;
  /** Any CSS colour, e.g. "var(--color-primary)". */
  color: string;
};

export type ReportChartRow = {
  /** X-axis label, e.g. "Mon, Sep 28, 2026". */
  label: string;
  /** Seconds per series, keyed by `ReportChartSeries.key`. A missing key counts as 0. */
  values: Record<string, number>;
};
