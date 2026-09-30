"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { INVITE_LINKS_QUERY_KEY } from "@/hooks/useInviteLinks";
import { useOrganisationTeams } from "@/hooks/useOrganisationTeams";
import { useProjects } from "@/hooks/useProjects";
import { saveInviteLink } from "@/lib/saveInviteLink";
import { fromInviteLinkExpiry, toInviteLinkExpiry } from "@/lib/toInviteLinkExpiry";
import type { InviteLink, InviteLinkRole } from "@/types/inviteLink";
import { AssignmentChecklist } from "./AssignmentChecklist";
import { ErrorMessage } from "./ErrorMessage";
import { InviteLinkLimitFields } from "./InviteLinkLimitFields";
import { InviteLinkRoleField } from "./InviteLinkRoleField";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";

type InviteLinkFormModalProps = {
  organisationId: string;
  /** The link to edit; omitted to create a new one. */
  link?: InviteLink;
  onClose: () => void;
};

const DEFAULT_EXPIRY_DAYS = 7;

export function InviteLinkFormModal({ organisationId, link, onClose }: InviteLinkFormModalProps) {
  const queryClient = useQueryClient();
  const organisationQuery = useCurrentOrganisation();
  const teamsQuery = useOrganisationTeams(organisationId);
  const projectsQuery = useProjects(organisationId, { status: "active" });

  const [name, setName] = useState(link?.name ?? "");
  const [role, setRole] = useState<InviteLinkRole>(link?.role ?? "member");
  const [teamIds, setTeamIds] = useState(new Set(link?.teamIds ?? []));
  const [projectIds, setProjectIds] = useState(new Set(link?.projectIds ?? []));
  const [expiryDate, setExpiryDate] = useState(() =>
    link
      ? fromInviteLinkExpiry(link.expiresAt)
      : new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 86_400_000).toLocaleDateString("en-CA"),
  );
  const [usageCap, setUsageCap] = useState(link?.usageCap ? String(link.usageCap) : "");
  const [enabled, setEnabled] = useState(link?.enabled ?? true);

  const isAdmin = organisationQuery.data?.role === "admin";
  const callerUserId = organisationQuery.data?.userId;
  // A manager can only put teams they manage on a link (enforced server-side).
  const managesTeam = (teamId: string) =>
    (teamsQuery.data ?? [])
      .find((team) => team.id === teamId)
      ?.members.some((member) => member.userId === callerUserId && member.isManager) ?? false;

  const mutation = useMutation({
    mutationFn: () =>
      saveInviteLink(
        organisationId,
        {
          name: name.trim(),
          role,
          teamIds: [...teamIds],
          projectIds: [...projectIds],
          expiresAt: toInviteLinkExpiry(expiryDate),
          usageCap: usageCap ? Number(usageCap) : null,
          enabled,
        },
        link?.id,
      ),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: INVITE_LINKS_QUERY_KEY(organisationId) });
        onClose();
      }
    },
  });
  const failure = mutation.data && !mutation.data.ok ? mutation.data.message : null;
  const capIsValid = usageCap === "" || (Number.isInteger(Number(usageCap)) && Number(usageCap) >= 1);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (name.trim() && capIsValid) mutation.mutate();
  }

  return (
    <Modal title={link ? "Edit invite link" : "Create invite link"} onClose={onClose} size="wide">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5 text-sm text-slate-900">
          Link name
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Autumn intake"
            maxLength={100}
            required
            className="rounded-md border border-input-border px-3 h-11 text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
          />
        </label>

        <InviteLinkRoleField value={role} onChange={setRole} />

        <div className="grid gap-5 sm:grid-cols-2">
          <AssignmentChecklist
            title="Teams"
            items={(teamsQuery.data ?? []).map((team) => ({
              id: team.id,
              name: team.name,
              disabledReason: isAdmin || managesTeam(team.id) ? undefined : "You can only add teams you manage",
            }))}
            selectedIds={teamIds}
            onChange={setTeamIds}
            emptyText={teamsQuery.isLoading ? "Loading teams…" : "No teams to choose from."}
          />
          <AssignmentChecklist
            title="Projects"
            items={(projectsQuery.data ?? []).map((project) => ({ id: project.id, name: project.name }))}
            selectedIds={projectIds}
            onChange={setProjectIds}
            emptyText={projectsQuery.isLoading ? "Loading projects…" : "No active projects to choose from."}
          />
        </div>

        <InviteLinkLimitFields
          expiryDate={expiryDate}
          onExpiryDateChange={setExpiryDate}
          usageCap={usageCap}
          onUsageCapChange={setUsageCap}
          enabled={enabled}
          onEnabledChange={setEnabled}
        />

        {!capIsValid && <ErrorMessage message="Usage cap must be a whole number of at least 1." />}
        {failure && <ErrorMessage message={failure} />}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="cursor-pointer rounded-md border border-input-border px-4 h-11 text-slate-900">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || !capIsValid || mutation.isPending}
            className="flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 h-11 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mutation.isPending && <Spinner />}
            {link ? "Save" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
