"use client";

import { useState } from "react";
import type { ActiveMember } from "@/types/membership";

type AddTeamMemberCandidateRowProps = {
  member: ActiveMember;
  isPending: boolean;
  onAdd: (membershipId: string, isManager: boolean) => void;
};

export function AddTeamMemberCandidateRow({
  member,
  isPending,
  onAdd,
}: AddTeamMemberCandidateRowProps) {
  const [role, setRole] = useState<"member" | "manager">("member");

  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-input-border px-3 py-2 text-slate-900">
      <span>
        {member.name ?? member.email}
        {member.name && (
          <span className="block text-xs text-slate-900/70">{member.email}</span>
        )}
      </span>
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`role-${member.id}`}>
          Role
        </label>
        <select
          id={`role-${member.id}`}
          value={role}
          onChange={(event) => setRole(event.target.value as "member" | "manager")}
          className="rounded-md border border-input-border px-2 py-1.5 text-sm text-slate-900"
        >
          <option value="member">Member</option>
          <option value="manager">Team manager</option>
        </select>
        <button
          type="button"
          onClick={() => onAdd(member.id, role === "manager")}
          disabled={isPending}
          className="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-sm text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
        >
          Add
        </button>
      </div>
    </li>
  );
}
