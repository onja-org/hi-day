"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CURRENT_ORGANISATION_QUERY_KEY,
  useCurrentOrganisation,
} from "@/hooks/useCurrentOrganisation";
import { updateOrganisation } from "@/lib/updateOrganisation";
import { ErrorMessage } from "@/components/ErrorMessage";
import { Spinner } from "@/components/Spinner";
import { Toggle } from "@/components/Toggle";

/**
 * Whether the Reason field is compulsory. On by default, because the add,
 * edit and delete-time forms have always demanded one — turning this off is
 * what changes behaviour, not turning it on.
 */
export function TimesheetRequireReasonPanel() {
  const organisationQuery = useCurrentOrganisation();
  const organisation = organisationQuery.data;
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (next: boolean) =>
      updateOrganisation(organisation!.id, { timesheetRequireReason: next }),
    onSuccess: (result) => {
      if (!result.ok) return;
      queryClient.setQueryData(
        CURRENT_ORGANISATION_QUERY_KEY,
        result.organisation,
      );
    },
  });

  if (organisationQuery.isLoading) {
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

  const error = mutation.data && !mutation.data.ok ? mutation.data.message : null;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h3 className="text-xs font-semibold tracking-wider text-slate-900/60 uppercase">
          Require reason
        </h3>
        <p className="text-sm text-slate-900">
          Whether a reason has to be given when time is added, edited or
          deleted. The reason is kept on the audit record and shown in the
          Manual time edits report.
        </p>
      </header>

      {error && <ErrorMessage message={error} />}

      <div className="rounded-brand-sm border-2 border-ink bg-white p-5">
        <Toggle
          name="timesheetRequireReason"
          label="Require a reason"
          description="With this off, the reason field is still offered but can be left blank."
          checked={organisation.timesheetRequireReason}
          onCheckedChange={(next) => mutation.mutate(next)}
        />
      </div>

      <p className="text-sm text-slate-900/60">
        What people can pick from is the{" "}
        <span className="font-semibold">Reasons</span> list.
      </p>
    </section>
  );
}
