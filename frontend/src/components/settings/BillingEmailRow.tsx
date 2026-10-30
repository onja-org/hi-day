"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOrganisation } from "@/lib/updateOrganisation";
import { CURRENT_ORGANISATION_QUERY_KEY } from "@/hooks/useCurrentOrganisation";
import { BillingDetailRow } from "./BillingDetailRow";

type BillingEmailRowProps = {
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
 *
 * Edits in place, in the row's own value slot, so the line being changed is
 * the line being read.
 */
export function BillingEmailRow({
  organisationId,
  billingEmail,
  fallbackEmail,
}: BillingEmailRowProps) {
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

  if (editing) {
    return (
      <BillingDetailRow
        title="Billing email"
        hint="Leave it empty to use the account email"
        action={
          <div className="flex gap-2">
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
        }
      >
        <label className="sr-only" htmlFor="billing-email">
          Billing email
        </label>
        <input
          id="billing-email"
          type="email"
          value={draft}
          placeholder={fallbackEmail ?? "billing@yourcompany.com"}
          onChange={(event) => setDraft(event.target.value)}
          className="h-11 w-full rounded-brand-sm border-2 border-ink bg-white px-3 font-sans text-sm font-normal text-ink placeholder:text-slate-900/40 focus:border-primary focus:outline-none"
        />
      </BillingDetailRow>
    );
  }

  return (
    <BillingDetailRow
      title="Billing email"
      // Says which of the two is in play, so nobody has to guess whether
      // their own address is the one receipts reach.
      hint={
        billingEmail
          ? "Receipts and billing notices"
          : "Using the account email"
      }
      action={
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex h-10 cursor-pointer items-center rounded-brand-sm border-2 border-ink bg-white px-3 text-sm font-bold text-ink transition-colors hover:bg-cream"
        >
          {billingEmail ? "Change" : "Add"}
        </button>
      }
    >
      {billingEmail ?? fallbackEmail ?? "—"}
    </BillingDetailRow>
  );
}
