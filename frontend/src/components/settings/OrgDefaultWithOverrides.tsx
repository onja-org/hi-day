"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import clsx from "clsx";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Spinner } from "@/components/Spinner";
import { Switch } from "@/components/Switch";
import { IndividualOverridesSection } from "./IndividualOverridesSection";

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
  /** Rendered between the organisation default and the member table, for a
   * further org-wide switch that belongs with the default rather than
   * under the overrides (Timesheets' "Approval permission"). */
  belowDefault?: ReactNode;
};

/** The reusable "org default + per-member override" pattern — an N-way
 * `SegmentedControl` for the whole org, a searchable member table where
 * each row can override it, and an "Apply to all" that clears every
 * override at once. Laid out after Hubstaff's equivalent settings page. */
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
  belowDefault,
}: Props<K>) {
  // Either column counts: "Apply to all" clears both in one request, so a
  // row overriding only the secondary still has something to reset.
  const anyOverride = useMemo(
    () =>
      rows.some(
        (row) =>
          row.override !== null || (row.secondaryOverride ?? null) !== null,
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
          Default
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
          <button
            type="button"
            onClick={onApplyToAll}
            disabled={!anyOverride || isResetting}
            className={clsx(
              "inline-flex h-11 cursor-pointer items-center rounded-brand-sm border-2 border-ink bg-primary px-4 font-bold text-white transition-colors duration-150",
              anyOverride && !isResetting && "hover:bg-primary/90",
              (!anyOverride || isResetting) && "cursor-not-allowed opacity-50",
            )}
          >
            {isResetting ? "Applying…" : "Apply to all"}
          </button>
          {isSavingOrg && <Spinner className="text-primary-dark" />}
        </div>
      </div>

      {belowDefault}

      <IndividualOverridesSection
        title={title}
        options={options}
        orgValue={orgValue}
        rows={rows}
        onMemberChange={onMemberChange}
        savingMemberIds={savingMemberIds}
        secondary={secondary}
      />
    </section>
  );
}
