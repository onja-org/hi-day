"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ACTIVE_MEMBERS_QUERY_KEY,
  useActiveMembers,
} from "@/hooks/useActiveMembers";
import {
  CURRENT_ORGANISATION_QUERY_KEY,
  useCurrentOrganisation,
} from "@/hooks/useCurrentOrganisation";
import { resetMembershipProjects } from "@/lib/resetMembershipProjects";
import { updateMembership } from "@/lib/updateMembership";
import { updateOrganisation } from "@/lib/updateOrganisation";
import type { ActiveMemberListItem } from "@/types/membership";
import { ErrorMessage } from "@/components/ErrorMessage";
import { Spinner } from "@/components/Spinner";
import { OrgDefaultWithOverrides } from "./OrgDefaultWithOverrides";

/** Stored as a boolean; the control is a two-way switch with these labels. */
const OPTIONS = [
  { key: "off", label: "Off" },
  { key: "on", label: "On" },
];

const toKey = (enabled: boolean) => (enabled ? "on" : "off");

export function ProjectsSettings() {
  const organisationQuery = useCurrentOrganisation();
  const organisation = organisationQuery.data;
  const organisationId = organisation ? String(organisation.id) : "";
  const membersQuery = useActiveMembers(organisationId, {
    enabled: Boolean(organisation),
  });
  const queryClient = useQueryClient();
  const [savingMemberIds, setSavingMemberIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [memberError, setMemberError] = useState<string | null>(null);

  const orgMutation = useMutation({
    mutationFn: (next: string) =>
      updateOrganisation(organisation!.id, { projectsEnabled: next === "on" }),
    onSuccess: (result) => {
      if (!result.ok) return;
      queryClient.setQueryData(
        CURRENT_ORGANISATION_QUERY_KEY,
        result.organisation,
      );
    },
  });

  const memberMutation = useMutation({
    mutationFn: async (input: {
      membershipId: string;
      enabled: boolean | null;
    }) => {
      const result = await updateMembership(organisationId, input.membershipId, {
        projectsEnabled: input.enabled,
      });
      return { membershipId: input.membershipId, result };
    },
    onMutate: ({ membershipId }) => {
      setMemberError(null);
      setSavingMemberIds((previous) => new Set(previous).add(membershipId));
    },
    onSettled: (_data, _error, { membershipId }) => {
      setSavingMemberIds((previous) => {
        const next = new Set(previous);
        next.delete(membershipId);
        return next;
      });
    },
    onSuccess: ({ membershipId, result }) => {
      if (!result.ok) {
        setMemberError(result.message);
        return;
      }
      queryClient.setQueryData<ActiveMemberListItem[]>(
        ACTIVE_MEMBERS_QUERY_KEY(organisationId),
        (previous) =>
          previous?.map((member) =>
            member.id === membershipId
              ? { ...member, projectsEnabled: result.member.projectsEnabled }
              : member,
          ) ?? previous,
      );
      // The admin's own Projects answer may have just changed.
      queryClient.invalidateQueries({
        queryKey: CURRENT_ORGANISATION_QUERY_KEY,
      });
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => resetMembershipProjects(organisationId),
    onSuccess: (result) => {
      if (!result.ok) return;
      queryClient.invalidateQueries({
        queryKey: ACTIVE_MEMBERS_QUERY_KEY(organisationId),
      });
      queryClient.invalidateQueries({
        queryKey: CURRENT_ORGANISATION_QUERY_KEY,
      });
    },
  });

  const rows = useMemo(
    () =>
      (membersQuery.data ?? []).map((member) => ({
        membershipId: member.id,
        name: member.name,
        email: member.email,
        override:
          member.projectsEnabled === null ? null : toKey(member.projectsEnabled),
      })),
    [membersQuery.data],
  );

  if (organisationQuery.isLoading || membersQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 py-8 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading…
      </p>
    );
  }

  if (!organisation) {
    return <ErrorMessage message="Could not load these settings." />;
  }

  const orgError =
    orgMutation.data && !orgMutation.data.ok ? orgMutation.data.message : null;
  const resetError =
    resetMutation.data && !resetMutation.data.ok
      ? resetMutation.data.message
      : null;

  return (
    <div className="flex flex-col gap-4 py-6">
      {(orgError || memberError || resetError) && (
        <ErrorMessage message={orgError ?? memberError ?? resetError ?? ""} />
      )}
      <OrgDefaultWithOverrides<string>
        title="Track time against Projects"
        description="Off: people start a timer with nothing to choose, and time is tracked per person. Existing Projects and the time logged to them are kept either way. A timer already running on a Project keeps going until it's stopped."
        options={OPTIONS}
        orgValue={toKey(organisation.projectsDefaultEnabled)}
        onOrgChange={(next) => orgMutation.mutate(next)}
        isSavingOrg={orgMutation.isPending}
        rows={rows}
        onMemberChange={(membershipId, next) =>
          memberMutation.mutate({
            membershipId,
            enabled: next === null ? null : next === "on",
          })
        }
        savingMemberIds={savingMemberIds}
        onApplyToAll={() => resetMutation.mutate()}
        isResetting={resetMutation.isPending}
      />
    </div>
  );
}
