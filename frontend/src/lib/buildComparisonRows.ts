import type { ComparisonRow } from "@/types/insights";

type ComparisonInput<T> = {
  memberLabel: string;
  member: T | null;
  /** `undefined` when the member is on no team — the row is left out, not shown empty. */
  team: T | null | undefined;
  organisation: T | null;
  /** Where the figure sits on the bar; a plain number runs from 0. */
  toSpan: (value: T) => { start: number; end: number };
  format: (value: T) => string;
};

/** The member, team-average and organisation-average rows for one Performance card. */
export function buildComparisonRows<T>(input: ComparisonInput<T>): ComparisonRow[] {
  const row = (label: string, value: T | null, highlight = false): ComparisonRow => ({
    label,
    span: value === null ? null : input.toSpan(value),
    display: value === null ? "–" : input.format(value),
    highlight,
  });

  return [
    row(input.memberLabel, input.member, true),
    ...(input.team === undefined ? [] : [row("Team avg.", input.team)]),
    row("Org avg.", input.organisation),
  ];
}
