"use client";

import { useState } from "react";
import { CaretRightIcon } from "@phosphor-icons/react";
import type { OrganisationTeam } from "@/types/team";
import { TeamDetail } from "./TeamDetail";

type TeamListRowProps = {
  organisationId: string;
  team: OrganisationTeam;
  isAdmin: boolean;
  onDelete: () => void;
};

/**
 * An expandable row, built on native `<details>`/`<summary>` (see
 * UrlSessionDomainAccordion for the same pattern) — expanding fetches and
 * shows the team's name/rename form and full member roster inline, so
 * viewing or managing a team's members no longer requires navigating to a
 * separate page.
 */
export function TeamListRow({ organisationId, team, isAdmin, onDelete }: TeamListRowProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <details
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      className="group rounded-md border border-input-border text-slate-900"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 transition-colors duration-150 hover:bg-cream">
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <CaretRightIcon
            size={16}
            aria-hidden="true"
            className="shrink-0 text-icon transition-transform duration-150 group-open:rotate-90"
          />
          <span className="truncate">{team.name}</span>
        </span>
        {isAdmin && (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onDelete();
            }}
            className="shrink-0 cursor-pointer text-sm text-error hover:underline"
          >
            Delete
          </button>
        )}
      </summary>

      {isOpen && (
        <div className="border-t border-input-border p-3">
          <TeamDetail organisationId={organisationId} teamId={team.id} showName={false} />
        </div>
      )}
    </details>
  );
}
