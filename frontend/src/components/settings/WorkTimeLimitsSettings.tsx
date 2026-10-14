"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import {
  ACTIVE_MEMBERS_QUERY_KEY,
  useActiveMembers,
} from "@/hooks/useActiveMembers";
import {
  CURRENT_ORGANISATION_QUERY_KEY,
  useCurrentOrganisation,
} from "@/hooks/useCurrentOrganisation";
import { updateMembership } from "@/lib/updateMembership";
import { updateOrganisation } from "@/lib/updateOrganisation";
import type { ActiveMemberListItem } from "@/types/membership";
import type { WorkTimeLimits } from "@/types/organisation";
import { ErrorMessage } from "@/components/ErrorMessage";
import { Spinner } from "@/components/Spinner";
import { TrackingRemindersPanel } from "./TrackingRemindersPanel";
import { WorkTimeLimitsDefaults } from "./WorkTimeLimitsDefaults";
import { WorkTimeLimitsMemberRow } from "./WorkTimeLimitsMemberRow";

export function WorkTimeLimitsSettings() {
  const organisationQuery = useCurrentOrganisation();
  const organisation = organisationQuery.data;
  const organisationId = organisation ? String(organisation.id) : "";
  const membersQuery = useActiveMembers(organisationId, {
    enabled: Boolean(organisation),
  });
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState<WorkTimeLimits | null>(null);
  const [savingMemberIds, setSavingMemberIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [memberError, setMemberError] = useState<string | null>(null);

  // Derived rather than seeded in an effect: `null` means "no edits", so
  // the stored values show through, Cancel is a reset to null, and a save
  // needs no second copy to stay in step with.
  const stored = organisation?.workTimeLimits;
  const current = draft ?? stored;

  const saveMutation = useMutation({
    mutationFn: (next: WorkTimeLimits) =>
      updateOrganisation(organisation!.id, next),
    onSuccess: (result) => {
      if (!result.ok) return;
      setDraft(null);
      queryClient.setQueryData(
        CURRENT_ORGANISATION_QUERY_KEY,
        result.organisation,
      );
    },
  });

  const memberMutation = useMutation({
    mutationFn: async (input: {
      membershipId: string;
      patch: Partial<WorkTimeLimits>;
    }) => {
      const result = await updateMembership(
        organisationId,
        input.membershipId,
        input.patch,
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
        ACTIVE_MEMBERS_QUERY_KEY(organisationId),
        (previous) =>
          previous?.map((member) =>
            member.id === membershipId ? { ...member, ...result.member } : member,
          ) ?? previous,
      );
    },
  });

  if (organisationQuery.isLoading || !current) {
    return (
      <p className="flex items-center gap-2 py-8 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading settings…
      </p>
    );
  }

  if (!organisation) {
    return <ErrorMessage message="Could not load these settings." />;
  }

  const isDirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(stored);
  const saveError =
    saveMutation.data && !saveMutation.data.ok ? saveMutation.data.message : null;

  return (
    <div className="flex flex-col gap-10 py-6">
      {(saveError || memberError) && (
        <ErrorMessage message={saveError ?? memberError ?? ""} />
      )}

      <section className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-primary-dark">
            Default settings
          </h2>
          <button
            type="button"
            disabled={!isDirty || saveMutation.isPending}
            onClick={() => saveMutation.mutate(current)}
            className={clsx(
              "inline-flex h-11 cursor-pointer items-center rounded-brand-sm border-2 border-ink bg-primary px-4 font-bold text-white transition-colors duration-150",
              isDirty && !saveMutation.isPending && "hover:bg-primary/90",
              (!isDirty || saveMutation.isPending) &&
                "cursor-not-allowed opacity-50",
            )}
          >
            {saveMutation.isPending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            disabled={!isDirty}
            onClick={() => setDraft(null)}
            className={clsx(
              "cursor-pointer text-sm font-medium text-primary",
              !isDirty && "cursor-not-allowed opacity-50",
            )}
          >
            Cancel
          </button>
        </div>

        <WorkTimeLimitsDefaults draft={current} onChange={setDraft} />
      </section>

      <TrackingRemindersPanel />

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-semibold text-primary-dark">
            Individual settings
          </h2>
          <p className="text-sm text-slate-900/60">
            Override the organisation default for specific members.
          </p>
        </div>

        <div className="overflow-x-auto rounded-brand-sm border-2 border-ink bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b-2 border-input-border bg-cream/40 text-xs tracking-wider text-slate-900/60 uppercase">
                <th scope="col" className="px-4 py-3 font-semibold">Name</th>
                <th scope="col" className="px-4 py-3 font-semibold">Weekly work days</th>
                <th scope="col" className="px-4 py-3 font-semibold">Expected work hours</th>
                <th scope="col" className="px-4 py-3 font-semibold">Weekly limit</th>
                <th scope="col" className="px-4 py-3 font-semibold">Daily limit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-input-border">
              {membersQuery.isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-slate-900/60">
                    Loading members…
                  </td>
                </tr>
              )}
              {(membersQuery.data ?? []).map((member) => (
                <WorkTimeLimitsMemberRow
                  key={member.id}
                  member={member}
                  organisationDefaults={current}
                  isSaving={savingMemberIds.has(member.id)}
                  onChange={(patch) =>
                    memberMutation.mutate({ membershipId: member.id, patch })
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
