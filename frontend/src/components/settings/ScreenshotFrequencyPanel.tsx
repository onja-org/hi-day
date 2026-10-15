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
import { resetMembershipScreenshotFrequency } from "@/lib/resetMembershipScreenshotFrequency";
import {
  perPeriodFromSeconds,
  SCREENSHOT_FREQUENCY_OPTIONS,
  secondsFromPerPeriod,
} from "@/lib/screenshotFrequency";
import { updateMembership } from "@/lib/updateMembership";
import { updateOrganisation } from "@/lib/updateOrganisation";
import type { ActiveMemberListItem } from "@/types/membership";
import { ErrorMessage } from "@/components/ErrorMessage";
import { Spinner } from "@/components/Spinner";
import { OrgDefaultWithOverrides } from "./OrgDefaultWithOverrides";

export function ScreenshotFrequencyPanel() {
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
    // "None" is the organisation's off switch, so it writes the boolean
    // too — the agent still needs a usable interval while disabled.
    mutationFn: (perPeriod: string) => {
      const seconds = secondsFromPerPeriod(perPeriod);
      return updateOrganisation(organisation!.id, {
        screenshotsEnabled: seconds > 0,
        ...(seconds > 0 ? { screenshotFrequencySeconds: seconds } : {}),
      });
    },
    onSuccess: (result) => {
      if (!result.ok) return;
      queryClient.setQueryData(
        CURRENT_ORGANISATION_QUERY_KEY,
        result.organisation,
      );
    },
  });

  const memberMutation = useMutation({
    mutationFn: async (input: { membershipId: string; perPeriod: string | null }) => {
      const result = await updateMembership(
        String(organisation!.id),
        input.membershipId,
        {
          screenshotFrequencySeconds:
            input.perPeriod === null
              ? null
              : secondsFromPerPeriod(input.perPeriod),
        },
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
              ? {
                  ...member,
                  screenshotFrequencySeconds:
                    result.member.screenshotFrequencySeconds,
                }
              : member,
          ) ?? previous,
      );
    },
  });

  const resetMutation = useMutation({
    mutationFn: () =>
      resetMembershipScreenshotFrequency(String(organisation!.id)),
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
        override:
          member.screenshotFrequencySeconds === null
            ? null
            : perPeriodFromSeconds(member.screenshotFrequencySeconds),
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
      <OrgDefaultWithOverrides<string>
        title="Screenshot frequency"
        description="How many screenshots are taken in a 10-minute period. None means no screenshots at all."
        options={[...SCREENSHOT_FREQUENCY_OPTIONS]}
        control="select"
        orgValue={
          organisation.screenshotsEnabled
            ? perPeriodFromSeconds(organisation.screenshotFrequencySeconds)
            : "0"
        }
        onOrgChange={(next) => orgMutation.mutate(next)}
        isSavingOrg={orgMutation.isPending}
        rows={rows}
        onMemberChange={(membershipId, perPeriod) =>
          memberMutation.mutate({ membershipId, perPeriod })
        }
        savingMemberIds={savingMemberIds}
        onApplyToAll={() => resetMutation.mutate()}
        isResetting={resetMutation.isPending}
      />
    </div>
  );
}
