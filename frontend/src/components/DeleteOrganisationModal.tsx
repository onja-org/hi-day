"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import {
  CheckIcon,
  EnvelopeSimpleIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { useOrganisationDeletionStatus } from "@/hooks/useOrganisationDeletionStatus";
import { requestOrganisationDeletion } from "@/lib/requestOrganisationDeletion";
import type {
  OrganisationDeletionMode,
  OrganisationProfile,
} from "@/types/organisation";
import { DeletionExportNotice } from "./DeletionExportNotice";
import { DeletionImpactStats } from "./DeletionImpactStats";
import { DeletionEmailSentModal } from "./DeletionEmailSentModal";
import { DeletionWhenFields } from "./DeletionWhenFields";
import { ErrorMessage } from "./ErrorMessage";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";

type DeleteOrganisationModalProps = {
  organisation: OrganisationProfile;
  onClose: () => void;
};

function tomorrowAsInputValue(): string {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrow.getDate()).padStart(2, "0");
  return `${tomorrow.getFullYear()}-${month}-${day}`;
}

export function DeleteOrganisationModal({
  organisation,
  onClose,
}: DeleteOrganisationModalProps) {
  const [mode, setMode] = useState<OrganisationDeletionMode>("now");
  const [scheduledDate, setScheduledDate] = useState(tomorrowAsInputValue);
  const [confirmName, setConfirmName] = useState("");
  const statusQuery = useOrganisationDeletionStatus(organisation.id, true);
  const status = statusQuery.data;

  const requestMutation = useMutation({
    mutationFn: () =>
      requestOrganisationDeletion(organisation.id, {
        mode,
        confirmName,
        ...(mode === "scheduled" && {
          scheduledFor: new Date(`${scheduledDate}T00:00:00`).toISOString(),
        }),
      }),
  });

  const emailSent = requestMutation.data?.ok === true;
  const failure =
    requestMutation.data && !requestMutation.data.ok
      ? requestMutation.data.message
      : null;
  const nameMatches = confirmName === organisation.name;
  const graceDays = status?.graceDays ?? null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    requestMutation.mutate();
  }

  if (emailSent) {
    return (
      <DeletionEmailSentModal
        ownerEmail={status?.ownerEmail ?? null}
        onClose={onClose}
      />
    );
  }

  return (
    <Modal title={`Delete ${organisation.name}?`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-error/10 text-error">
            <WarningIcon size={20} aria-hidden="true" />
          </span>
          <p className="text-sm text-slate-900/70">
            This permanently removes everything in the organisation, including
            screenshots. Desktop agents stop tracking and sign out.
          </p>
        </div>

        {status && <DeletionImpactStats impact={status.impact} />}
        <DeletionExportNotice organisationId={organisation.id} />

        <DeletionWhenFields
          mode={mode}
          onModeChange={setMode}
          scheduledDate={scheduledDate}
          onScheduledDateChange={setScheduledDate}
          minDate={tomorrowAsInputValue()}
          graceDays={graceDays}
        />

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-900">
            Type{" "}
            <code className="rounded-md bg-cream px-1.5 py-0.5">
              {organisation.name}
            </code>{" "}
            to confirm
          </span>
          <span className="relative">
            <input
              type="text"
              value={confirmName}
              onChange={(event) => setConfirmName(event.target.value)}
              autoComplete="off"
              className="w-full rounded-md border border-input-border bg-white px-3 pr-9 h-11 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {nameMatches && (
              <CheckIcon
                size={18}
                aria-hidden="true"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-success"
              />
            )}
          </span>
        </label>

        {failure && <ErrorMessage message={failure} />}

        <p className="flex items-start gap-2 text-xs text-slate-900/60">
          <EnvelopeSimpleIcon size={16} aria-hidden="true" className="shrink-0" />
          We&rsquo;ll email a confirmation link to{" "}
          {status?.ownerEmail ?? "the owner"}. Nothing is deleted until you
          click it.
        </p>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md border border-input-border px-4 h-11 text-slate-900"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!nameMatches || requestMutation.isPending}
            className="flex cursor-pointer items-center gap-2 rounded-md bg-error px-4 h-11 text-white transition-colors duration-150 hover:bg-error/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {requestMutation.isPending && <Spinner />}
            Send confirmation email
          </button>
        </div>
      </form>
    </Modal>
  );
}
