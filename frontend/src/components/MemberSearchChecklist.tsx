"use client";

import { useState } from "react";
import { MemberSelectRow } from "./MemberSelectRow";
import { Spinner } from "./Spinner";

type MemberCandidate = {
  id: string;
  name: string | null;
  email: string;
};

type MemberSearchChecklistProps<TRole extends string> = {
  candidates: MemberCandidate[];
  selected: Map<string, TRole>;
  /** The first option is the default for a newly-checked row. */
  roleOptions: { value: TRole; label: string }[];
  onToggle: (id: string, checked: boolean) => void;
  onRoleChange: (id: string, role: TRole) => void;
  /** Shown when there are no candidates at all (before any search). */
  emptyMessage: string;
  isLoading?: boolean;
};

/** Search box + checkbox list shared by the Projects and Teams "add
 * members" modals — extracted so both stay under this codebase's
 * component size guideline, and so the two features can't quietly drift
 * apart in how bulk-selecting members works. */
export function MemberSearchChecklist<TRole extends string>({
  candidates,
  selected,
  roleOptions,
  onToggle,
  onRoleChange,
  emptyMessage,
  isLoading,
}: MemberSearchChecklistProps<TRole>) {
  const [search, setSearch] = useState("");
  const search_ = search.trim().toLowerCase();
  const visible = candidates.filter((candidate) => {
    if (!search_) return true;
    return [candidate.name, candidate.email]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(search_));
  });

  return (
    <div className="flex flex-col gap-3">
      <label className="sr-only" htmlFor="member-search-checklist-search">
        Search members
      </label>
      <input
        id="member-search-checklist-search"
        type="search"
        placeholder="Search by name or email"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="rounded-md border border-input-border px-3 py-2 text-sm text-slate-900"
      />

      {isLoading ? (
        <p className="flex items-center gap-2 text-slate-900">
          <Spinner className="text-primary-dark" />
          Loading members…
        </p>
      ) : (
        <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {visible.map((candidate) => (
            <MemberSelectRow
              key={candidate.id}
              id={candidate.id}
              name={candidate.name}
              email={candidate.email}
              checked={selected.has(candidate.id)}
              role={selected.get(candidate.id) ?? roleOptions[0].value}
              roleOptions={roleOptions}
              onCheckedChange={(checked) => onToggle(candidate.id, checked)}
              onRoleChange={(role) => onRoleChange(candidate.id, role)}
            />
          ))}
          {visible.length === 0 && (
            <li className="text-slate-900">
              {search_ ? "No members match your search." : emptyMessage}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
