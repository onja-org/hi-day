"use client";

import { useMemo, useState } from "react";
import { SearchInput } from "@/components/SearchInput";
import { matchesSearch } from "@/lib/matchesSearch";
import { MemberOverrideRow } from "./MemberOverrideRow";
import type {
  OrgDefaultOption,
  OverrideRow,
  SecondaryToggleColumn,
} from "./OrgDefaultWithOverrides";

type IndividualOverridesSectionProps<K extends string> = {
  /** Names the main column, as it does the organisation default above. */
  title: string;
  options: OrgDefaultOption<K>[];
  orgValue: K;
  rows: OverrideRow<K>[];
  onMemberChange: (membershipId: string, next: K | null) => void;
  savingMemberIds: ReadonlySet<string>;
  secondary?: SecondaryToggleColumn<K>;
};

/** The searchable per-member table under the organisation default. */
export function IndividualOverridesSection<K extends string>({
  title,
  options,
  orgValue,
  rows,
  onMemberChange,
  savingMemberIds,
  secondary,
}: IndividualOverridesSectionProps<K>) {
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(
    () => rows.filter((row) => matchesSearch([row.name, row.email], search)),
    [rows, search],
  );
  const columnCount = secondary ? 3 : 2;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h4 className="text-base font-semibold text-primary-dark">
            Individual settings
          </h4>
          <p className="text-sm text-slate-900/60">
            Override the organisation default for specific members.
          </p>
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search members"
        />
      </div>

      {/* A real table, so each control sits under the header that names it —
          the flex rows this replaced couldn't line up, because a segmented
          control's width follows its own option labels. */}
      <div className="overflow-x-auto rounded-brand-sm border-2 border-ink bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b-2 border-input-border bg-cream/40 text-xs tracking-wider text-slate-900/60 uppercase">
              <th scope="col" className="px-4 py-3 font-semibold">
                Name
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                {title}
              </th>
              {secondary && (
                <th scope="col" className="px-4 py-3 font-semibold">
                  {secondary.label}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-input-border">
            {filteredRows.length === 0 && (
              <tr>
                <td
                  colSpan={columnCount}
                  className="px-4 py-6 text-sm text-slate-900/60"
                >
                  {rows.length === 0
                    ? "No members to show."
                    : "No members match that search."}
                </td>
              </tr>
            )}
            {filteredRows.map((row) => (
              <MemberOverrideRow
                key={row.membershipId}
                row={row}
                title={title}
                options={options}
                orgValue={orgValue}
                isSaving={savingMemberIds.has(row.membershipId)}
                onMemberChange={onMemberChange}
                secondary={secondary}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
