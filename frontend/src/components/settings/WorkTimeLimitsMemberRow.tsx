"use client";

import { useState } from "react";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";

import { describeWorkDays } from "@/lib/describeWorkDays";
import { getInitials } from "@/lib/getInitials";
import type { ActiveMemberListItem } from "@/types/membership";
import type { WorkTimeLimits } from "@/types/organisation";
import { Spinner } from "@/components/Spinner";
import { HoursField } from "./HoursField";

type WorkTimeLimitsMemberRowProps = {
  member: ActiveMemberListItem;
  /** Shown where the member has no override of their own. */
  organisationDefaults: WorkTimeLimits;
  isSaving: boolean;
  onChange: (patch: Partial<WorkTimeLimits>) => void;
};

/** Long enough to absorb a run of stepper clicks, short enough that a
 * value feels saved by the time attention moves on. */
const SAVE_DELAY_MS = 700;

export function WorkTimeLimitsMemberRow({
  member,
  organisationDefaults,
  isSaving,
  onChange,
}: WorkTimeLimitsMemberRowProps) {
  const who = member.name ?? member.email;
  // What was typed here, shown in preference to the server's value.
  // Deliberately never cleared: clearing on *fire* reverted the field to
  // the stale value for the length of the round trip, which is the jump.
  // Once the response lands the two agree, so it stops mattering.
  const [typed, setTyped] = useState<Partial<WorkTimeLimits>>({});
  const save = useDebouncedCallback(onChange, SAVE_DELAY_MS);

  const edit = (patch: Partial<WorkTimeLimits>) => {
    setTyped((previous) => ({ ...previous, ...patch }));
    save(patch);
  };
  const shown = { ...member, ...typed };
  const workDays = member.expectedWorkDays ?? organisationDefaults.expectedWorkDays;
  const disabledDays =
    member.trackingDisabledDays ?? organisationDefaults.trackingDisabledDays;

  return (
    <tr>
      <td className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white"
          >
            {getInitials(member.name, member.email)}
          </span>
          <span className="truncate font-medium text-primary">{who}</span>
          {/* A fixed slot: rendering the spinner inline shifted the whole
              row every time a value saved. */}
          <span className="flex size-4 shrink-0 items-center justify-center">
            {isSaving && <Spinner className="text-primary-dark" />}
          </span>
        </div>
      </td>

      <td className="px-4 py-3 text-sm text-slate-900">
        <div className="flex flex-col gap-0.5">
          <span>
            Expected work days:{" "}
            <span className="font-semibold">{describeWorkDays(workDays)}</span>
          </span>
          <span className="text-slate-900/70">
            Not allowed to track time on: {describeWorkDays(disabledDays)}
          </span>
        </div>
      </td>

      <td className="px-4 py-3">
        <HoursField
          compact
          label={`Expected work hours for ${who}`}
          unit="wk"
          value={shown.expectedWeeklyHours}
          onChange={(expectedWeeklyHours) => edit({ expectedWeeklyHours })}
        />
      </td>
      <td className="px-4 py-3">
        <HoursField
          compact
          label={`Weekly limit for ${who}`}
          unit="wk"
          value={shown.weeklyLimitHours}
          onChange={(weeklyLimitHours) => edit({ weeklyLimitHours })}
        />
      </td>
      <td className="px-4 py-3">
        <HoursField
          compact
          max={24}
          label={`Daily limit for ${who}`}
          unit="day"
          value={shown.dailyLimitHours}
          onChange={(dailyLimitHours) => edit({ dailyLimitHours })}
        />
      </td>
    </tr>
  );
}
