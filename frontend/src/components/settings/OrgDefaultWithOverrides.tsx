"use client";

import { useMemo, useState } from "react";
import { XCircle } from "@phosphor-icons/react";
import clsx from "clsx";
import { SearchInput } from "@/components/SearchInput";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Spinner } from "@/components/Spinner";
import { getInitials } from "@/lib/getInitials";
import { matchesSearch } from "@/lib/matchesSearch";

export type OrgDefaultOption<K extends string> = {
  key: K;
  label: string;
};

export type OverrideRow<K extends string> = {
  membershipId: string;
  name: string | null;
  email: string;
  /** `null` means this member inherits the organisation default. */
  override: K | null;
};

type Props<K extends string> = {
  /** Shown in uppercase above the global toggle, e.g. "TRACK APPS & URLS". */
  title: string;
  description: string;
  options: OrgDefaultOption<K>[];
  orgValue: K;
  onOrgChange: (next: K) => void;
  isSavingOrg: boolean;
  rows: OverrideRow<K>[];
  onMemberChange: (membershipId: string, next: K | null) => void;
  savingMemberIds: ReadonlySet<string>;
  /** Clears every per-member override at once ("Apply to all"). */
  onApplyToAll: () => void;
  isResetting: boolean;
};

/** The reusable "org default + per-member override" pattern — a 3-way (or
 * N-way) `SegmentedControl` for the whole org, a searchable member list
 * where each row can override the default, and an "Apply to all" button
 * that clears every override at once. See the Settings epic's shared
 * ticket. */
export function OrgDefaultWithOverrides<K extends string>({
  title,
  description,
  options,
  orgValue,
  onOrgChange,
  isSavingOrg,
  rows,
  onMemberChange,
  savingMemberIds,
  onApplyToAll,
  isResetting,
}: Props<K>) {
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(
    () => rows.filter((row) => matchesSearch([row.name, row.email], search)),
    [rows, search],
  );
  const anyOverride = useMemo(
    () => rows.some((row) => row.override !== null),
    [rows],
  );

  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h3 className="text-xs font-semibold tracking-wider text-slate-900/60 uppercase">
          {title}
        </h3>
        <p className="text-sm text-slate-900">{description}</p>
      </header>

      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold tracking-wider text-slate-900/60 uppercase">
          Global
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            label={title}
            options={options}
            value={orgValue}
            onChange={onOrgChange}
          />
          {isSavingOrg && <Spinner className="text-primary-dark" />}
          <button
            type="button"
            onClick={onApplyToAll}
            disabled={!anyOverride || isResetting}
            className={clsx(
              "ml-auto inline-flex h-11 items-center rounded-brand-sm border-2 border-ink px-4 font-semibold text-slate-900 transition-colors duration-150",
              anyOverride && !isResetting && "hover:bg-cream",
              (!anyOverride || isResetting) && "opacity-50",
            )}
          >
            {isResetting ? "Applying…" : "Apply to all"}
          </button>
        </div>
      </div>

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

        <ul className="flex flex-col divide-y-2 divide-input-border rounded-brand-sm border-2 border-ink bg-white">
          {filteredRows.length === 0 && (
            <li className="px-4 py-6 text-sm text-slate-900/60">
              {rows.length === 0
                ? "No members to show."
                : "No members match that search."}
            </li>
          )}
          {filteredRows.map((row) => {
            const effective: K = row.override ?? orgValue;
            const isOverridden = row.override !== null;
            const isSaving = savingMemberIds.has(row.membershipId);
            return (
              <li
                key={row.membershipId}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white"
                  >
                    {getInitials(row.name, row.email)}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-primary">
                      {row.name ?? row.email}
                    </span>
                    {row.name && (
                      <span className="truncate text-xs text-slate-900/70">
                        {row.email}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isSaving && <Spinner className="text-primary-dark" />}
                  <SegmentedControl
                    label={`${title} for ${row.name ?? row.email}`}
                    options={options}
                    value={effective}
                    onChange={(next) => onMemberChange(row.membershipId, next)}
                  />
                  {isOverridden && (
                    <button
                      type="button"
                      aria-label={`Clear override for ${row.name ?? row.email}`}
                      onClick={() => onMemberChange(row.membershipId, null)}
                      className="rounded-brand-sm p-1 text-slate-900/60 hover:bg-cream hover:text-primary-dark"
                    >
                      <XCircle size={20} weight="fill" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
