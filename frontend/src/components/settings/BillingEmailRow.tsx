"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOrganisation } from "@/lib/updateOrganisation";
import { CURRENT_ORGANISATION_QUERY_KEY } from "@/hooks/useCurrentOrganisation";

type BillingEmailCardProps = {
  organisationId: number;
  /** Null when none is set — receipts then go to the founder's own address. */
  billingEmail: string | null;
  /** Shown as the fallback, so "where do receipts go" is always answered. */
  fallbackEmail: string | null;
};

/**
 * Where receipts and billing notices go.
 *
 * Stored on the Organisation rather than taken from the Stripe customer:
 * the two are different addresses, and this is the one our own mail uses.
 * Clearing it falls back to the address the account was created with, which
 * is why the field is never required.
 */
export function BillingEmailCard({
  organisationId,
  billingEmail,
  fallbackEmail,
}: BillingEmailCardProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(billingEmail ?? "");

  const save = useMutation({
    mutationFn: (value: string) =>
      // '' clears it, the same convention the other optional profile fields
      // use — the service normalises it back to null.
      updateOrganisation(organisationId, { billingEmail: value }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(
        draft.trim()
          ? `Receipts will go to ${draft.trim()}.`
          : "Receipts will go to the account email again.",
      );
      setEditing(false);
      void queryClient.invalidateQueries({
        queryKey: CURRENT_ORGANISATION_QUERY_KEY,
      });
    },
  });

  const shown = billingEmail ?? fallbackEmail ?? "—";

  return (
    <div className="rounded-brand-sm border-2 border-ink bg-white p-5">
      <h3 className="text-sm font-bold text-primary-dark">Billing email</h3>
      <p className="mt-0.5 text-xs text-slate-900/60">
        Where receipts and billing notices are sent
      </p>

      {editing ? (
        <div className="mt-3 flex flex-col gap-2">
          <label className="sr-only" htmlFor="billing-email">
            Billing email
          </label>
          <input
            id="billing-email"
            type="email"
            value={draft}
            placeholder={fallbackEmail ?? "billing@yourcompany.com"}
            onChange={(event) => setDraft(event.target.value)}
            className="h-11 rounded-brand-sm border-2 border-ink bg-white px-3 text-sm text-ink placeholder:text-slate-900/40 focus:border-primary focus:outline-none"
          />
          <p className="text-xs text-slate-900/60">
            Leave it empty to use the account email.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(billingEmail ?? "");
                setEditing(false);
              }}
              className="flex h-10 cursor-pointer items-center rounded-brand-sm border-2 border-ink bg-white px-3 text-sm font-bold text-ink hover:bg-cream"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => save.mutate(draft.trim())}
              disabled={save.isPending}
              className="flex h-10 cursor-pointer items-center rounded-brand-sm border-2 border-ink bg-primary px-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {save.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-3 rounded-brand-sm bg-cream/60 px-3 py-2 font-data text-sm font-bold break-all text-primary-dark">
            {shown}
          </p>
          {/* Says which of the two is in play, so nobody has to guess whether
              their own address is the one receipts reach. */}
          <p className="mt-1 text-xs text-slate-900/60">
            {billingEmail
              ? "Set for this organisation."
              : "Using the account email. Set one to send receipts elsewhere."}
          </p>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex h-10 cursor-pointer items-center rounded-brand-sm border-2 border-ink bg-white px-3 text-sm font-bold text-ink transition-colors hover:bg-cream"
            >
              {billingEmail ? "Change" : "Add"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
