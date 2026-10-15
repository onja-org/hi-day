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
import { resetMembershipScreenshotDelete } from "@/lib/resetMembershipScreenshotDelete";
import { updateMembership } from "@/lib/updateMembership";
import { updateOrganisation } from "@/lib/updateOrganisation";
import type { ActiveMemberListItem } from "@/types/membership";
import { ErrorMessage } from "@/components/ErrorMessage";
import { Spinner } from "@/components/Spinner";
import { OrgDefaultWithOverrides } from "./OrgDefaultWithOverrides";

/** The control is two-way, but stored as a boolean — these are the labels. */
const OPTIONS = [
  { key: "no", label: "Not allowed" },
  { key: "yes", label: "Allowed" },
];

const toKey = (allowed: boolean) => (allowed ? "yes" : "no");

export function ScreenshotDeletePanel() {
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
      updateOrganisation(organisation!.id, {
        membersCanDeleteScreenshots: next === "yes",
      }),
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
      allowed: boolean | null;
    }) => {
      const result = await updateMembership(organisationId, input.membershipId, {
        canDeleteScreenshots: input.allowed,
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
              ? { ...member, canDeleteScreenshots: result.member.canDeleteScreenshots }
              : member,
          ) ?? previous,
      );
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => resetMembershipScreenshotDelete(organisationId),
    onSuccess: (result) => {
      if (!result.ok) return;
      queryClient.invalidateQueries({
        queryKey: ACTIVE_MEMBERS_QUERY_KEY(organisationId),
      });
    },
  });

  const rows = useMemo(
    () =>
      (membersQuery.data ?? [])
        // Finance has no access to the screenshots routes at all, so an
        // override on one could never take effect.
        .filter((member) => member.role !== "finance")
        .map((member) => ({
          membershipId: member.id,
          name: member.name,
          email: member.email,
          override:
            member.canDeleteScreenshots === null
              ? null
              : toKey(member.canDeleteScreenshots),
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
    <div className="flex flex-col gap-4">
      {(orgError || memberError || resetError) && (
        <ErrorMessage message={orgError ?? memberError ?? resetError ?? ""} />
      )}
      <OrgDefaultWithOverrides<string>
        title="Members can delete their own screenshots"
        description="A delete button appears on each of their own screenshots. Admins can always delete anyone's, whatever this says."
        options={OPTIONS}
        orgValue={toKey(organisation.membersCanDeleteScreenshots)}
        onOrgChange={(next) => orgMutation.mutate(next)}
        isSavingOrg={orgMutation.isPending}
        rows={rows}
        onMemberChange={(membershipId, next) =>
          memberMutation.mutate({
            membershipId,
            allowed: next === null ? null : next === "yes",
          })
        }
        savingMemberIds={savingMemberIds}
        onApplyToAll={() => resetMutation.mutate()}
        isResetting={resetMutation.isPending}
      />
    </div>
  );
}
