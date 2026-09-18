"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import {
  disclosureDraftQueryKey,
  useDisclosureDraft,
} from "@/hooks/useDisclosureDraft";
import { disclosureVersionHistoryQueryKey } from "@/hooks/useDisclosureVersionHistory";
import { publishDisclosureVersion } from "@/lib/publishDisclosureVersion";
import { updateDisclosureDraft } from "@/lib/updateDisclosureDraft";
import { DisclosureVersionHistory } from "./DisclosureVersionHistory";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

const PUBLISH_CONFIRM_MESSAGE =
  "Publishing re-prompts every device that needs to consent to this region's disclosure text before it can keep capturing. Continue?";

export function DisclosureDraftForm() {
  const organisationQuery = useCurrentOrganisation();
  const queryClient = useQueryClient();
  const [region, setRegion] = useState("");
  const normalizedRegion = region.trim() || null;
  const organisationId = organisationQuery.data?.id;

  const draftQuery = useDisclosureDraft(organisationId ?? 0, normalizedRegion);

  const saveDraftMutation = useMutation({
    mutationFn: (text: string) =>
      updateDisclosureDraft(organisationId!, normalizedRegion, text),
    onSuccess: (result) => {
      if (result.ok && organisationId !== undefined) {
        queryClient.setQueryData(
          disclosureDraftQueryKey(organisationId, normalizedRegion),
          result.draft,
        );
      }
    },
  });

  const publishMutation = useMutation({
    mutationFn: () =>
      publishDisclosureVersion(organisationId!, normalizedRegion),
    onSuccess: (result) => {
      if (result.ok && organisationId !== undefined) {
        queryClient.invalidateQueries({
          queryKey: disclosureVersionHistoryQueryKey(
            organisationId,
            normalizedRegion,
          ),
        });
      }
    },
  });

  function handleSaveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    saveDraftMutation.mutate(String(formData.get("text") ?? ""));
  }

  function handlePublish() {
    if (!window.confirm(PUBLISH_CONFIRM_MESSAGE)) return;
    publishMutation.mutate();
  }

  if (organisationQuery.isLoading || draftQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading disclosure text…
      </p>
    );
  }

  if (organisationQuery.isError || !organisationQuery.data) {
    return (
      <ErrorMessage
        message={
          organisationQuery.error instanceof Error
            ? organisationQuery.error.message
            : "Could not load organisation."
        }
      />
    );
  }

  if (draftQuery.isError || !draftQuery.data) {
    return (
      <ErrorMessage
        message={
          draftQuery.error instanceof Error
            ? draftQuery.error.message
            : "Could not load the disclosure draft."
        }
      />
    );
  }

  const draft = draftQuery.data;

  return (
    <div className="flex w-full max-w-4xl flex-col gap-8">
      <label className="flex max-w-xs flex-col gap-1.5">
        Region code (optional)
        <input
          type="text"
          value={region}
          onChange={(event) => setRegion(event.target.value)}
          placeholder="e.g. FR — leave blank for the org default"
          className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>

      <form
        key={draft.id}
        onSubmit={handleSaveDraft}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1.5">
          Disclosure text
          <textarea
            name="text"
            defaultValue={draft.text}
            rows={10}
            required
            className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saveDraftMutation.isPending}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-primary px-4 py-2 text-primary transition-colors duration-150 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saveDraftMutation.isPending && <Spinner />}
            {saveDraftMutation.isPending ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishMutation.isPending}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
          >
            {publishMutation.isPending && <Spinner />}
            {publishMutation.isPending ? "Publishing…" : "Publish"}
          </button>
        </div>
      </form>

      <DisclosureVersionHistory
        organisationId={organisationQuery.data.id}
        region={normalizedRegion}
      />
    </div>
  );
}
