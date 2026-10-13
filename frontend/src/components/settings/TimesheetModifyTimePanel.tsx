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
import { resetMembershipTimesheetOverrides } from "@/lib/resetMembershipTimesheetOverrides";
import { updateMembership } from "@/lib/updateMembership";
import { updateOrganisation } from "@/lib/updateOrganisation";
import type {
  ActiveMemberListItem,
  UpdateMembershipInput,
} from "@/types/membership";
import type {
  TimesheetModifyTime,
  UpdateOrganisationInput,
} from "@/types/organisation";
import { ErrorMessage } from "@/components/ErrorMessage";
import { Spinner } from "@/components/Spinner";
import { Toggle } from "@/components/Toggle";
import { OrgDefaultWithOverrides } from "./OrgDefaultWithOverrides";

const MODIFY_TIME_OPTIONS: { key: TimesheetModifyTime; label: string }[] = [
  { key: "add_edit", label: "Add & edit" },
  { key: "off", label: "Off" },
];

export function TimesheetModifyTimePanel() {
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
    mutationFn: (input: UpdateOrganisationInput) =>
      updateOrganisation(organisation!.id, input),
    onSuccess: (result) => {
      if (!result.ok) return;
      queryClient.setQueryData(
        CURRENT_ORGANISATION_QUERY_KEY,
        result.organisation,
      );
    },
  });

  const memberMutation = useMutation({
    mutationFn: async ({
      membershipId,
      input,
    }: {
      membershipId: string;
      input: UpdateMembershipInput;
    }) => {
      const result = await updateMembership(
        String(organisation!.id),
        membershipId,
        input,
      );
      return { membershipId, result };
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
                  timesheetModifyTime: result.member.timesheetModifyTime,
                  timesheetRequireApproval:
                    result.member.timesheetRequireApproval,
                }
              : member,
          ) ?? previous,
      );
    },
  });

  const resetMutation = useMutation({
    mutationFn: () =>
      resetMembershipTimesheetOverrides(String(organisation!.id)),
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
        override: member.timesheetModifyTime,
        secondaryOverride: member.timesheetRequireApproval,
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
    <div className="flex flex-col gap-8">
      {(orgError || memberError || resetError) && (
        <ErrorMessage message={orgError ?? memberError ?? resetError ?? ""} />
      )}

      <OrgDefaultWithOverrides<TimesheetModifyTime>
        title="Modify time (manual time)"
        description="Your team's ability to modify time — adding manual time and editing previously tracked time. Leave it Off to allow none. It applies to every role, admins included; what varies is whose time you can change: an admin anyone's, a manager their teams', a member their own. Members can always delete their own time."
        options={MODIFY_TIME_OPTIONS}
        orgValue={organisation.timesheetModifyTime}
        onOrgChange={(next) =>
          orgMutation.mutate({ timesheetModifyTime: next })
        }
        isSavingOrg={orgMutation.isPending}
        rows={rows}
        onMemberChange={(membershipId, next) =>
          memberMutation.mutate({
            membershipId,
            input: { timesheetModifyTime: next },
          })
        }
        savingMemberIds={savingMemberIds}
        onApplyToAll={() => resetMutation.mutate()}
        isResetting={resetMutation.isPending}
        secondary={{
          label: "Require approval",
          orgValue: organisation.timesheetRequireApproval,
          onOrgChange: (next) =>
            orgMutation.mutate({ timesheetRequireApproval: next }),
          onMemberChange: (membershipId, next) =>
            memberMutation.mutate({
              membershipId,
              input: { timesheetRequireApproval: next },
            }),
          // Approval is meaningless for someone who cannot modify time at
          // all — greyed out, but the stored value is kept for when the
          // control comes back on.
          disabledWhen: (effective) => effective === "off",
        }}
        belowDefault={
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold tracking-wider text-slate-900/60 uppercase">
              Approval permission
            </span>
            <Toggle
              name="timesheetManagersApproveOwn"
              label="Allow managers to approve or deny their own manual time"
              description="With this off, a manager's own manual time waits for someone else to approve it."
              checked={organisation.timesheetManagersApproveOwn}
              onCheckedChange={(next) =>
                orgMutation.mutate({ timesheetManagersApproveOwn: next })
              }
            />
          </div>
        }
      />
    </div>
  );
}
