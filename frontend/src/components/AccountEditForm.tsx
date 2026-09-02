"use client";

import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MY_PROFILE_QUERY_KEY, useMyProfile } from "@/hooks/useMyProfile";
import { updateMyProfile } from "@/lib/updateMyProfile";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";
import { SuccessMessage } from "./SuccessMessage";

export function AccountEditForm() {
  const queryClient = useQueryClient();
  const profileQuery = useMyProfile();

  const updateMutation = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.setQueryData(MY_PROFILE_QUERY_KEY, result.profile);
      }
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") ?? "");
    updateMutation.mutate({ name });
  }

  if (profileQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading your account…
      </p>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <ErrorMessage
        message={
          profileQuery.error instanceof Error
            ? profileQuery.error.message
            : "Could not load your account."
        }
      />
    );
  }

  const profile = profileQuery.data;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-lg flex-col gap-6"
    >
      {updateMutation.data?.ok && <SuccessMessage message="Name updated." />}
      {updateMutation.data && !updateMutation.data.ok && (
        <ErrorMessage message={updateMutation.data.message} />
      )}

      <label className="flex flex-col gap-1.5">
        Full name
        <input
          name="name"
          type="text"
          defaultValue={profile.name ?? ""}
          required
          className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>

      <button
        type="submit"
        disabled={updateMutation.isPending}
        className="flex cursor-pointer items-center justify-center gap-2 self-start rounded-md bg-primary px-4 py-2 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
      >
        {updateMutation.isPending && <Spinner />}
        {updateMutation.isPending ? "Saving…" : "Save name"}
      </button>

      <label className="flex flex-col gap-1.5">
        Email address
        <input
          type="email"
          value={profile.email}
          disabled
          className="rounded-md border border-input-border bg-cream/50 px-3 py-2 text-slate-900 opacity-70"
        />
        <span className="text-sm text-slate-900">Coming soon.</span>
      </label>
    </form>
  );
}
