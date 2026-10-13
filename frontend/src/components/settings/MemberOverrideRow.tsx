"use client";

import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Spinner } from "@/components/Spinner";
import { Switch } from "@/components/Switch";
import { getInitials } from "@/lib/getInitials";
import type {
  OrgDefaultOption,
  OverrideRow,
  SecondaryToggleColumn,
} from "./OrgDefaultWithOverrides";

type MemberOverrideRowProps<K extends string> = {
  row: OverrideRow<K>;
  title: string;
  options: OrgDefaultOption<K>[];
  orgValue: K;
  isSaving: boolean;
  onMemberChange: (membershipId: string, next: K | null) => void;
  secondary?: SecondaryToggleColumn<K>;
};

export function MemberOverrideRow<K extends string>({
  row,
  title,
  options,
  orgValue,
  isSaving,
  onMemberChange,
  secondary,
}: MemberOverrideRowProps<K>) {
  const who = row.name ?? row.email;
  const effective: K = row.override ?? orgValue;
  const isOverridden =
    row.override !== null || (row.secondaryOverride ?? null) !== null;

  // In the last control cell, not a column of its own. Not an ✕ either —
  // the switch beside it already draws one in its knob while off.
  const clearButton = isOverridden && (
    <button
      type="button"
      title={`Reset ${who} to the organisation default`}
      aria-label={`Reset ${who} to the organisation default`}
      onClick={() => {
        onMemberChange(row.membershipId, null);
        // Both columns go together, matching "Apply to all": a cleared row
        // inherits the org default outright.
        secondary?.onMemberChange(row.membershipId, null);
      }}
      className="cursor-pointer rounded-brand-sm p-1 text-slate-900/60 hover:bg-cream hover:text-primary-dark"
    >
      <ArrowCounterClockwiseIcon size={18} weight="bold" aria-hidden="true" />
    </button>
  );

  return (
    <tr>
      <td className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white"
          >
            {getInitials(row.name, row.email)}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-primary">{who}</span>
            {row.name && (
              <span className="truncate text-xs text-slate-900/70">
                {row.email}
              </span>
            )}
          </span>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <SegmentedControl
            label={`${title} for ${who}`}
            options={options}
            value={effective}
            onChange={(next) => onMemberChange(row.membershipId, next)}
          />
          {isSaving && <Spinner className="text-primary-dark" />}
          {!secondary && clearButton}
        </div>
      </td>

      {secondary && (
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Switch
              label={`${secondary.label} for ${who}`}
              // The row's own effective value, not the org default: a member
              // overridden to Off has nothing to approve.
              checked={row.secondaryOverride ?? secondary.orgValue}
              disabled={secondary.disabledWhen(effective)}
              onCheckedChange={(next) =>
                secondary.onMemberChange(row.membershipId, next)
              }
            />
            {clearButton}
          </div>
        </td>
      )}
    </tr>
  );
}
