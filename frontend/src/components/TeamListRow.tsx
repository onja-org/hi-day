"use client";

import Link from "next/link";
import type { OrganisationTeam } from "@/types/team";

type TeamListRowProps = {
  organisationId: string;
  team: OrganisationTeam;
  isAdmin: boolean;
  onAddMember: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function TeamListRow({
  organisationId,
  team,
  isAdmin,
  onAddMember,
  onEdit,
  onDelete,
}: TeamListRowProps) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-input-border px-3 py-2 text-slate-900">
      <Link
        href={`/organisations/${organisationId}/teams/${team.id}`}
        className="hover:underline"
      >
        {team.name}
      </Link>
      {isAdmin && (
        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={onAddMember}
            className="cursor-pointer text-primary hover:underline"
          >
            Add members
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="cursor-pointer text-primary hover:underline"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="cursor-pointer text-error hover:underline"
          >
            Delete
          </button>
        </div>
      )}
    </li>
  );
}
