"use client";

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

export function WorkTimeLimitsMemberRow({
  member,
  organisationDefaults,
  isSaving,
  onChange,
}: WorkTimeLimitsMemberRowProps) {
  const who = member.name ?? member.email;
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
          {isSaving && <Spinner className="text-primary-dark" />}
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
          value={member.expectedWeeklyHours}
          onChange={(expectedWeeklyHours) => onChange({ expectedWeeklyHours })}
        />
      </td>
      <td className="px-4 py-3">
        <HoursField
          compact
          label={`Weekly limit for ${who}`}
          unit="wk"
          value={member.weeklyLimitHours}
          onChange={(weeklyLimitHours) => onChange({ weeklyLimitHours })}
        />
      </td>
      <td className="px-4 py-3">
        <HoursField
          compact
          max={24}
          label={`Daily limit for ${who}`}
          unit="day"
          value={member.dailyLimitHours}
          onChange={(dailyLimitHours) => onChange({ dailyLimitHours })}
        />
      </td>
    </tr>
  );
}
