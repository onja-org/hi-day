"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { updateMembership } from "@/lib/updateMembership";
import { ErrorMessage } from "./ErrorMessage";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";

type EditMemberActivityVisibilityModalProps = {
  organisationId: string;
  membershipId: string;
  /** Name, falling back to email — the dialog title only. */
  memberLabel: string;
  /** Current per-member override: `null` inherits the org default. */
  currentOverride: boolean | null;
  /** Fired with the saved override so the caller can refresh its own cache
   * (the Members list and the Teams page keep different queries). */
  onSaved: (override: boolean | null) => void;
  onClose: () => void;
};

/** The stored override is tri-state; this control makes that explicit. */
type Choice = "inherit" | "on" | "off";

const CHOICES: { key: Choice; label: string; description: string }[] = [
  {
    key: "inherit",
    label: "Use organisation default",
    description:
      "Follow the workspace-wide setting for whether this member sees their own activity.",
  },
  {
    key: "on",
    label: "Can see their own activity",
    description:
      "This member sees their own Activity page and dashboard activity widgets.",
  },
  {
    key: "off",
    label: "Hidden from this member",
    description:
      "The Activity page and dashboard activity widgets are hidden from this member entirely — they cannot tell the data is being collected.",
  },
];

const toChoice = (override: boolean | null): Choice =>
  override === null ? "inherit" : override ? "on" : "off";

const fromChoice = (choice: Choice): boolean | null =>
  choice === "inherit" ? null : choice === "on";

/**
 * Per-member override of "Members can see their own activity", editable by
 * an admin (anyone) or a team manager (their own team's members — enforced
 * server-side in MembershipsService.update). A manager hiding a member's
 * own activity is the case this exists for; they reach it from the Teams
 * page, since the admin-only Settings area is closed to them.
 */
export function EditMemberActivityVisibilityModal({
  organisationId,
  membershipId,
  memberLabel,
  currentOverride,
  onSaved,
  onClose,
}: EditMemberActivityVisibilityModalProps) {
  const [choice, setChoice] = useState<Choice>(toChoice(currentOverride));

  const mutation = useMutation({
    mutationFn: () =>
      updateMembership(organisationId, membershipId, {
        canViewOwnActivity: fromChoice(choice),
      }),
    onSuccess: (result) => {
      if (!result.ok) return;
      onSaved(result.member.canViewOwnActivity);
      onClose();
    },
  });
  const failure =
    mutation.data && !mutation.data.ok ? mutation.data.message : null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <Modal title={`Activity visibility · ${memberLabel}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Activity visibility</legend>
          {CHOICES.map((option) => (
            <label
              key={option.key}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-input-border p-3 has-checked:border-primary has-checked:bg-primary/5"
            >
              <input
                type="radio"
                name="canViewOwnActivity"
                value={option.key}
                checked={choice === option.key}
                onChange={() => setChoice(option.key)}
                className="mt-1 accent-primary"
              />
              <span className="flex flex-col">
                <span className="font-medium text-slate-900">
                  {option.label}
                </span>
                <span className="text-sm text-slate-900/70">
                  {option.description}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        {failure && <ErrorMessage message={failure} />}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-brand-sm border-2 border-ink px-4 h-11 text-slate-900 font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={choice === toChoice(currentOverride) || mutation.isPending}
            className="flex cursor-pointer items-center gap-2 rounded-brand-sm bg-primary px-4 h-11 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 border-2 border-ink font-bold"
          >
            {mutation.isPending && <Spinner />}
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
