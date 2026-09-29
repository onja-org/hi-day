"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatMembershipRole } from "@/lib/formatMembershipRole";
import { getInviteLinkPreview } from "@/lib/getInviteLinkPreview";
import { requestInviteLinkJoin } from "@/lib/requestInviteLinkJoin";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";
import { SuccessMessage } from "./SuccessMessage";

type JoinViaLinkFormProps = {
  token: string;
};

/**
 * The page an invite link opens. Asks for an email and sends an ordinary
 * invitation there — the person joins by accepting it, which proves they
 * own the address. Every outcome after submitting reads the same, so the
 * page can't be used to find out who's already a member.
 */
export function JoinViaLinkForm({ token }: JoinViaLinkFormProps) {
  const [email, setEmail] = useState("");

  const previewQuery = useQuery({
    queryKey: ["invite-link-preview", token],
    queryFn: async () => {
      const result = await getInviteLinkPreview(token);
      if (!result.ok) throw new Error(result.message);
      return result.preview;
    },
  });

  const mutation = useMutation({
    mutationFn: () => requestInviteLinkJoin(token, email.trim()),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (email.trim()) mutation.mutate();
  }

  if (previewQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Checking your invite link…
      </p>
    );
  }

  if (previewQuery.isError || !previewQuery.data) {
    return <ErrorMessage message="We couldn't check this invite link. Please try again." />;
  }

  const preview = previewQuery.data;
  if (preview.status !== "active") {
    return (
      <div className="flex w-full max-w-sm flex-col gap-2">
        <ErrorMessage
          message={
            preview.status === "not_found"
              ? "This invite link is invalid."
              : "This invite link is no longer active. Ask whoever shared it for a new one."
          }
        />
      </div>
    );
  }

  if (mutation.data?.ok) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-3">
        <SuccessMessage message={mutation.data.message} />
        <p className="text-sm text-slate-900/70">
          Open the email from {preview.organisationName} and follow the link to finish joining.
        </p>
      </div>
    );
  }

  const failure = mutation.data && !mutation.data.ok ? mutation.data.message : null;

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <p className="text-slate-900">
        You&apos;ve been invited to join <strong>{preview.organisationName}</strong>
        {preview.role && ` as a ${formatMembershipRole(preview.role).toLowerCase()}`}. Enter your
        email and we&apos;ll send you an invitation to confirm it.
      </p>
      <label className="flex flex-col gap-1.5 text-sm text-slate-900">
        Email
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
          className="rounded-md border border-input-border px-3 py-2 text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
        />
      </label>
      {failure && <ErrorMessage message={failure} />}
      <button
        type="submit"
        disabled={mutation.isPending}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {mutation.isPending && <Spinner />}
        Send me an invitation
      </button>
    </form>
  );
}
