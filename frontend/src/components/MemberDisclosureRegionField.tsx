"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ACTIVE_MEMBERS_QUERY_KEY } from "@/hooks/useActiveMembers";
import { updateMembership } from "@/lib/updateMembership";
import type { ActiveMember } from "@/types/membership";

type MemberDisclosureRegionFieldProps = {
  organisationId: string;
  member: ActiveMember;
  editable: boolean;
};

export function MemberDisclosureRegionField({
  organisationId,
  member,
  editable,
}: MemberDisclosureRegionFieldProps) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(member.disclosureRegion ?? "");

  const mutation = useMutation({
    mutationFn: (disclosureRegion: string | null) =>
      updateMembership(organisationId, member.id, { disclosureRegion }),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({
          queryKey: ACTIVE_MEMBERS_QUERY_KEY(organisationId),
        });
      }
    },
  });

  function commit() {
    const normalized = value.trim() || null;
    if (normalized === (member.disclosureRegion ?? null)) return;
    mutation.mutate(normalized);
  }

  if (!editable) {
    return (
      <span className="text-slate-900">{member.disclosureRegion ?? "—"}</span>
    );
  }

  return (
    <input
      type="text"
      value={value}
      disabled={mutation.isPending}
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      placeholder="org default"
      title="Which disclosure/consent text this person sees — leave blank for the org default"
      className="w-24 rounded-md border border-input-border bg-white px-2 py-1 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
    />
  );
}
