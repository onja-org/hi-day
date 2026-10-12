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
import { resetMembershipAllowedApps } from "@/lib/resetMembershipAllowedApps";
import { updateMembership } from "@/lib/updateMembership";
import { updateOrganisation } from "@/lib/updateOrganisation";
import type { ActiveMemberListItem } from "@/types/membership";
import type { AllowedApps } from "@/types/organisation";
import { ErrorMessage } from "@/components/ErrorMessage";
import { Spinner } from "@/components/Spinner";
import { OrgDefaultWithOverrides } from "./OrgDefaultWithOverrides";

const ALLOWED_APPS_OPTIONS: { key: AllowedApps; label: string }[] = [
  { key: "all", label: "All apps" },
  { key: "desktop_only", label: "Desktop only" },
  { key: "mobile_only", label: "Mobile only" },
];

export function AllowedAppsPanel() {
  const organisationQuery = useCurrentOrganisation();
  const organisation = organisationQuery.data;
  const membersQuery = useActiveMembers(
    organisation ? String(organisation.id) : "",
    { enabled: Boolean(organisation) },
  );
  const queryClient = useQueryClient();
  const [savingMemberIds, setSavingMemberIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [memberError, setMemberError] = useState<string | null>(null);

  const orgMutation = useMutation({
    mutationFn: (next: AllowedApps) =>
      updateOrganisation(organisation!.id, { allowedApps: next }),
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
      allowedApps: AllowedApps | null;
    }) => {
      const result = await updateMembership(
        String(organisation!.id),
        input.membershipId,
        { allowedApps: input.allowedApps },
      );
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
        ACTIVE_MEMBERS_QUERY_KEY(String(organisation!.id)),
        (previous) =>
          previous?.map((member) =>
            member.id === membershipId
              ? { ...member, allowedApps: result.member.allowedApps }
              : member,
          ) ?? previous,
      );
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => resetMembershipAllowedApps(String(organisation!.id)),
    onSuccess: (result) => {
      if (!result.ok) return;
      queryClient.invalidateQueries({
        queryKey: ACTIVE_MEMBERS_QUERY_KEY(String(organisation!.id)),
      });
    },
  });

  const rows = useMemo(
    () =>
      (membersQuery.data ?? []).map((member) => ({
        membershipId: member.id,
        name: member.name,
        email: member.email,
        override: member.allowedApps,
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
    return (
      <ErrorMessage
        message={
          organisationQuery.error instanceof Error
            ? organisationQuery.error.message
            : "Could not load these settings."
        }
      />
    );
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
      <OrgDefaultWithOverrides<AllowedApps>
        title="Allowed apps"
        description="Which timer apps a team member can use. There is no mobile app yet, so “Mobile only” leaves a member with no way to track time at all."
        options={ALLOWED_APPS_OPTIONS}
        orgValue={organisation.allowedApps}
        onOrgChange={(next) => orgMutation.mutate(next)}
        isSavingOrg={orgMutation.isPending}
        rows={rows}
        onMemberChange={(membershipId, allowedApps) =>
          memberMutation.mutate({ membershipId, allowedApps })
        }
        savingMemberIds={savingMemberIds}
        onApplyToAll={() => resetMutation.mutate()}
        isResetting={resetMutation.isPending}
      />
    </div>
  );
}
