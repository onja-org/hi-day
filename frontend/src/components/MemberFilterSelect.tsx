"use client";

import { useActiveMembers } from "@/hooks/useActiveMembers";

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

  if (!canViewOthers || !membersQuery.data) {
    return null;
  }

  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-md border border-input-border bg-white px-3 py-1.5 text-sm text-slate-900"
    >
      <option value="">My activity</option>
      {membersQuery.data.map((member) => (
        <option key={member.id} value={member.id}>
          {member.name ?? member.email}
        </option>
      ))}
    </select>
  );
}
