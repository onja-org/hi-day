"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useInvalidateTeams } from "@/hooks/useInvalidateTeams";
import { bulkActivityVisibilityTargets } from "@/lib/bulkActivityVisibilityTargets";
import { setTeamActivityVisibility } from "@/lib/setTeamActivityVisibility";
import type { TeamMember } from "@/types/team";
import { SelectField } from "@/components/ui/form";
import { ErrorMessage } from "./ErrorMessage";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";

type TeamActivityVisibilityBulkProps = {
  organisationId: string;
  teamId: string;
  teamName: string;
  members: TeamMember[];
  /** The viewer's own membership, so "everyone" never includes them. */
  callerUserId: string | undefined;
};

type Choice = "inherit" | "on" | "off";

const CHOICES: { key: Choice; label: string }[] = [
  { key: "off", label: "Hidden from them" },
  { key: "on", label: "They can see it" },
  { key: "inherit", label: "Use organisation default" },
];

const fromChoice = (choice: Choice): boolean | null =>
  choice === "inherit" ? null : choice === "on";

/**
 * Applies "can see their own activity" to a whole team in one request.
 * Only the directions that take something away ask first — a confirm on
 * the safe one would just train people to click through.
 */
export function TeamActivityVisibilityBulk({
  organisationId,
  teamId,
  teamName,
  members,
  callerUserId,
}: TeamActivityVisibilityBulkProps) {
  const invalidate = useInvalidateTeams(organisationId);
  const [choice, setChoice] = useState<Choice>("off");
  const [confirming, setConfirming] = useState(false);
  const [applied, setApplied] = useState<string | null>(null);

  // What the server will target, as far as this page can see it; the
  // result message below reports the real number.
  const targets = bulkActivityVisibilityTargets(members, callerUserId);

  const mutation = useMutation({
    mutationFn: () =>
      setTeamActivityVisibility(organisationId, teamId, fromChoice(choice)),
    onSuccess: (result) => {
      setConfirming(false);
      if (!result.ok) return;
      setApplied(
        `${result.updated} member${result.updated === 1 ? "" : "s"} updated.`,
      );
      invalidate();
    },
  });
  const failure =
    mutation.data && !mutation.data.ok ? mutation.data.message : null;

  function apply() {
    setApplied(null);
    if (choice === "inherit") {
      mutation.mutate();
      return;
    }
    setConfirming(true);
  }

  const chosenLabel = CHOICES.find((option) => option.key === choice)?.label;

  return (
    <section className="flex flex-col gap-3 rounded-md border border-input-border p-3">
      <div>
        <h3 className="font-semibold text-slate-900">
          Activity visibility for the whole team
        </h3>
        <p className="text-sm text-slate-900/70">
          Applies to the {targets.length} member
          {targets.length === 1 ? "" : "s"} this affects. Admins and anyone
          managing a team always see their own activity, so they are left out.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <SelectField
          label="Set every member to"
          value={choice}
          onChange={(event) => setChoice(event.target.value as Choice)}
          className="min-w-56"
        >
          {CHOICES.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </SelectField>
        <button
          type="button"
          onClick={apply}
          disabled={targets.length === 0 || mutation.isPending}
          className="flex h-11 cursor-pointer items-center gap-2 rounded-brand-sm border-2 border-ink bg-primary px-4 font-bold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutation.isPending && <Spinner />}
          Apply to team
        </button>
      </div>

      {failure && <ErrorMessage message={failure} />}
      {applied && <p className="text-sm text-slate-900">{applied}</p>}

      {confirming && (
        <Modal
          title="Apply to the whole team?"
          onClose={() => setConfirming(false)}
        >
          <div className="flex flex-col gap-4">
            <p className="text-slate-900">
              Set <strong>{chosenLabel}</strong> for {targets.length} member
              {targets.length === 1 ? "" : "s"} of {teamName}. This replaces
              whatever each of them has now, and what they had is not kept.
            </p>
            {choice === "off" && (
              <p className="text-sm text-slate-900/70">
                Their Activity page and dashboard activity widgets disappear
                entirely — they cannot tell the data is being collected.
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="h-11 cursor-pointer rounded-brand-sm border-2 border-ink px-4 font-semibold text-slate-900 hover:bg-cream"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                className="flex h-11 cursor-pointer items-center gap-2 rounded-brand-sm border-2 border-ink bg-primary px-4 font-bold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {mutation.isPending && <Spinner />}
                Apply
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
