"use client";

import { useMemo, useState } from "react";
import { XCircle } from "@phosphor-icons/react";
import clsx from "clsx";
import { SearchInput } from "@/components/SearchInput";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Spinner } from "@/components/Spinner";
import { Switch } from "@/components/Switch";
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
  /** The secondary column's override; `null` inherits. Ignored unless a
   * `secondary` column is configured. */
  secondaryOverride?: boolean | null;
};

/**
 * An optional on/off column beside the main control, for a setting that
 * only qualifies the first one (Timesheets' "Require approval" beside
 * "Modify time"). `disabledWhen` greys it out per row — approval means
 * nothing for someone who can't modify time at all — without clearing what
 * was stored, so the value returns when the main control comes back on.
 */
export type SecondaryToggleColumn<K extends string> = {
  label: string;
  orgValue: boolean;
  onOrgChange: (next: boolean) => void;
  onMemberChange: (membershipId: string, next: boolean | null) => void;
  disabledWhen: (effective: K) => boolean;
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
  secondary?: SecondaryToggleColumn<K>;
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
  secondary,
}: Props<K>) {
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(
    () => rows.filter((row) => matchesSearch([row.name, row.email], search)),
    [rows, search],
  );
  // Either column counts: "Apply to all" clears both in one request, so a
  // row overriding only the secondary still has something to reset.
  const anyOverride = useMemo(
    () =>
      rows.some(
        (row) =>
          row.override !== null ||
          (row.secondaryOverride ?? null) !== null,
      ),
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
          {secondary && (
            <span
              className={clsx(
                "flex items-center gap-2 text-sm font-medium text-slate-900",
                secondary.disabledWhen(orgValue) && "text-slate-900/50",
              )}
            >
              <Switch
                label={secondary.label}
                checked={secondary.orgValue}
                onCheckedChange={secondary.onOrgChange}
                disabled={secondary.disabledWhen(orgValue)}
              />
              {secondary.label}
            </span>
          )}
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

        {/* Names the columns the rows below carry. Deliberately not
            width-matched to the controls — the segmented control's width
            follows its option labels, so any fixed alignment would drift. */}
        <div className="hidden items-center justify-between gap-6 px-4 text-xs font-semibold tracking-wider text-slate-900/60 uppercase md:flex">
          <span>Name</span>
          <span className="flex items-center gap-6">
            <span>{title}</span>
            {secondary && <span>{secondary.label}</span>}
          </span>
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
            const isOverridden =
              row.override !== null || (row.secondaryOverride ?? null) !== null;
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
                  {secondary && (
                    <Switch
                      label={`${secondary.label} for ${row.name ?? row.email}`}
                      // The row's own effective value, not the org default:
                      // a member overridden to Off has nothing to approve.
                      checked={row.secondaryOverride ?? secondary.orgValue}
                      disabled={secondary.disabledWhen(effective)}
                      onCheckedChange={(next) =>
                        secondary.onMemberChange(row.membershipId, next)
                      }
                    />
                  )}
                  {isOverridden && (
                    <button
                      type="button"
                      aria-label={`Clear override for ${row.name ?? row.email}`}
                      onClick={() => {
                        onMemberChange(row.membershipId, null);
                        // Both columns go together, matching "Apply to all":
                        // a cleared row inherits the org default outright.
                        secondary?.onMemberChange(row.membershipId, null);
                      }}
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
