"use client";

import { useState } from "react";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { SearchInput } from "./SearchInput";
import { TeamFormModal } from "./TeamFormModal";
import { TeamsList } from "./TeamsList";

type TeamsPageContentProps = {
  organisationId: string;
};

export function TeamsPageContent({ organisationId }: TeamsPageContentProps) {
  const organisationQuery = useCurrentOrganisation();
  const isAdmin = organisationQuery.data?.role === "admin";
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary-dark">Teams</h1>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={search} onChange={setSearch} placeholder="Search teams" />
        {isAdmin && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="shrink-0 cursor-pointer rounded-md bg-primary px-5 h-11 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary/90"
          >
            Add team
          </button>
        )}
      </div>

      <TeamsList organisationId={organisationId} search={search} />

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
