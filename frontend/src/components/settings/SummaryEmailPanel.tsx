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
import { resetMembershipSummaryEmails } from "@/lib/resetMembershipSummaryEmails";
import { SUMMARY_FREQUENCY_OPTIONS } from "@/lib/summaryEmailLabels";
import { updateMembership } from "@/lib/updateMembership";
import { updateOrganisation } from "@/lib/updateOrganisation";
import type { ActiveMemberListItem } from "@/types/membership";
import type { SummaryAudience, SummaryFrequency } from "@/types/summaryEmails";
import { ErrorMessage } from "@/components/ErrorMessage";
import { Spinner } from "@/components/Spinner";
import { OrgDefaultWithOverrides } from "./OrgDefaultWithOverrides";

const COPY: Record<SummaryAudience, { title: string; description: string }> = {
  personal: {
    title: "Personal summary email",
    description:
      "A recap of each person's own tracked time — total, per day, per project and activity — sent the morning after the day or week ends. Days with no tracked time are skipped. Each person can still turn these off for themselves.",
  },
  team: {
    title: "Team summary email",
    description:
      "For admins and team managers: who worked how much, who tracked no time, and manual time changes across the people they oversee, sent the morning after the day or week ends.",
  },
};

type SummaryEmailPanelProps = { audience: SummaryAudience };

export function SummaryEmailPanel({ audience }: SummaryEmailPanelProps) {
  const field =
    audience === "personal" ? "personalSummaryEmails" : "teamSummaryEmails";
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
    mutationFn: (next: SummaryFrequency) =>
      updateOrganisation(organisation!.id, { [field]: next }),
    onSuccess: (result) => {
      if (!result.ok) return;
      queryClient.setQueryData(CURRENT_ORGANISATION_QUERY_KEY, result.organisation);
    },
  });

  const memberMutation = useMutation({
    mutationFn: async (input: {
      membershipId: string;
      frequency: SummaryFrequency | null;
    }) => {
      const result = await updateMembership(organisationId, input.membershipId, {
        [field]: input.frequency,
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
              ? { ...member, [field]: result.member[field] }
              : member,
          ) ?? previous,
      );
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => resetMembershipSummaryEmails(organisationId, audience),
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
        // Finance tracks no time, and team summaries only ever reach admins
        // and team managers — an override on anyone else does nothing.
        .filter(
          (member) =>
            member.role !== "finance" &&
            (audience === "personal" ||
              member.role === "admin" ||
              member.managesTeam),
        )
        .map((member) => ({
          membershipId: member.id,
          name: member.name,
          email: member.email,
          override: member[field],
        })),
    [membersQuery.data, audience, field],
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
      <OrgDefaultWithOverrides<SummaryFrequency>
        title={COPY[audience].title}
        description={COPY[audience].description}
        options={SUMMARY_FREQUENCY_OPTIONS}
        orgValue={organisation[field]}
        onOrgChange={(next) => orgMutation.mutate(next)}
        isSavingOrg={orgMutation.isPending}
        rows={rows}
        onMemberChange={(membershipId, next) =>
          memberMutation.mutate({ membershipId, frequency: next })
        }
        savingMemberIds={savingMemberIds}
        onApplyToAll={() => resetMutation.mutate()}
        isResetting={resetMutation.isPending}
      />
    </div>
  );
}
