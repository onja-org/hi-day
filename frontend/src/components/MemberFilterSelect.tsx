"use client";

import { useActiveMembers } from "@/hooks/useActiveMembers";
import { useMyProfile } from "@/hooks/useMyProfile";

type MemberFilterSelectProps = {
  organisationId: string;
  /** "" means "my own". */
  value: string;
  onChange: (membershipId: string) => void;
  canViewOthers: boolean;
};

/** Shared member switcher for the Activities pages — same `<select>`
 * pattern already used inline on the Timesheets page, extracted so all four
 * activity tabs (and Timesheets) don't each reimplement it. */
export function MemberFilterSelect({
  organisationId,
  value,
  onChange,
  canViewOthers,
}: MemberFilterSelectProps) {
  const membersQuery = useActiveMembers(organisationId);
  const profileQuery = useMyProfile();
  const profile = profileQuery.data;

  if (!canViewOthers || !membersQuery.data) {
    return null;
  }

  // The "" option already stands for the caller, so their own membership
  // (which the list includes for admins, and for managers on their own
  // team) is dropped to avoid showing their name twice.
  const otherMembers = membersQuery.data.filter(
    (member) => member.email !== profile?.email,
  );
  const selfLabel = profile ? `${profile.name ?? profile.email} (You)` : "You";

  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Member"
      className="max-w-xs truncate rounded-md border border-input-border bg-white px-3 py-1.5 text-sm text-slate-900"
    >
      <option value="">{selfLabel}</option>
      {otherMembers.map((member) => (
        <option key={member.id} value={member.id}>
          {member.name ?? member.email}
        </option>
      ))}
    </select>
  );
}
