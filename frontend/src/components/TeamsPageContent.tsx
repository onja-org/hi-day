"use client";

import { useState } from "react";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { TeamFormModal } from "./TeamFormModal";
import { TeamsList } from "./TeamsList";

type TeamsPageContentProps = {
  organisationId: string;
};

export function TeamsPageContent({ organisationId }: TeamsPageContentProps) {
  const organisationQuery = useCurrentOrganisation();
  const isAdmin = organisationQuery.data?.role === "admin";
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-primary-dark">Teams</h1>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="cursor-pointer rounded-md bg-primary px-4 py-2 text-white transition-colors duration-150 hover:bg-primary/90"
          >
            New team
          </button>
        )}
      </div>

      <TeamsList organisationId={organisationId} />

      {createOpen && (
        <TeamFormModal
          organisationId={organisationId}
          onClose={() => setCreateOpen(false)}
          onSaved={() => setCreateOpen(false)}
        />
      )}
    </div>
  );
}
