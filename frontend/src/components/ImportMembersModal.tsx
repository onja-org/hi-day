"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { useOrganisationTeams } from "@/hooks/useOrganisationTeams";
import { PENDING_INVITATIONS_QUERY_KEY } from "@/hooks/usePendingInvitations";
import { useProjects } from "@/hooks/useProjects";
import { inviteMembers } from "@/lib/inviteMembers";
import { memberImportTemplateCsv } from "@/lib/memberImportTemplateCsv";
import { parseMemberImportRows } from "@/lib/parseMemberImportRows";
import type { MemberImportRow } from "@/lib/parseMemberImportRows";
import { readImportFile } from "@/lib/readImportFile";
import type { InviteEntryResult } from "@/types/invitation";
import { ErrorMessage } from "./ErrorMessage";
import { ImportPreviewTable } from "./ImportPreviewTable";
import { ImportTemplateButton } from "./ImportTemplateButton";
import { InviteResultsList } from "./InviteResultsList";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";

type ImportMembersModalProps = {
  organisationId: string;
  onClose: () => void;
};

// Matches the invitations endpoint's per-request cap.
const INVITES_PER_REQUEST = 200;

export function ImportMembersModal({ organisationId, onClose }: ImportMembersModalProps) {
  const queryClient = useQueryClient();
  const organisationQuery = useCurrentOrganisation();
  const teamsQuery = useOrganisationTeams(organisationId);
  const projectsQuery = useProjects(organisationId, { status: "active" });
  const [rows, setRows] = useState<MemberImportRow[] | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [results, setResults] = useState<InviteEntryResult[] | null>(null);

  const teams = teamsQuery.data ?? [];
  const teamNames = new Map(teams.map((team) => [team.id, team.name]));
  const validEntries = (rows ?? []).flatMap((row) => (row.entry ? [row.entry] : []));

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setRows(null);
    setResults(null);
    setFileError(null);
    if (!file) return;
    try {
      const parsed = parseMemberImportRows(await readImportFile(file), {
        teams,
        projects: projectsQuery.data ?? [],
        canInviteAdmins: organisationQuery.data?.role === "admin",
      });
      if (parsed.headerError) setFileError(parsed.headerError);
      else if (parsed.rows.length === 0) setFileError("That file has no member rows.");
      else setRows(parsed.rows);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Couldn't read that file.");
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const collected: InviteEntryResult[] = [];
      for (let start = 0; start < validEntries.length; start += INVITES_PER_REQUEST) {
        const result = await inviteMembers(
          organisationId,
          validEntries.slice(start, start + INVITES_PER_REQUEST),
        );
        if (!result.ok) return { ok: false as const, message: result.message };
        collected.push(...result.results);
      }
      setResults(collected);
      const sent = collected.filter((r) => r.outcome === "sent" || r.outcome === "resent").length;
      return { ok: true as const, message: `Sent ${sent} of ${collected.length} invites` };
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: PENDING_INVITATIONS_QUERY_KEY(organisationId) }),
  });

  const lookupsLoading = teamsQuery.isLoading || projectsQuery.isLoading;

  return (
    <Modal title="Import members" onClose={onClose} size="wide">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-900">
          Upload a <strong>.csv</strong> or <strong>.xlsx</strong> file. The first row names the
          columns: <code>email</code> (required), <code>role</code> (admin, manager or member),{" "}
          <code>teams</code> and <code>projects</code> (names, several separated by{" "}
          <code>;</code>). Everyone listed gets an invite email.
        </p>
        <ImportTemplateButton
          filename="members-import-template.csv"
          buildCsv={() =>
            memberImportTemplateCsv(
              teams.map((team) => team.name),
              (projectsQuery.data ?? []).map((project) => project.name),
            )
          }
        />

        {results ? (
          <InviteResultsList results={results} />
        ) : (
          <label className="flex flex-col gap-1.5 text-sm text-slate-900">
            File
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={handleFile}
              disabled={lookupsLoading}
              className="rounded-brand-sm border-2 border-ink bg-white px-3 py-2 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-primary"
            />
          </label>
        )}

        {fileError && <ErrorMessage message={fileError} />}
        {rows && !results && <ImportPreviewTable rows={rows} teamNames={teamNames} />}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-brand-sm border-2 border-ink px-4 h-11 text-slate-900 font-semibold"
          >
            {results ? "Done" : "Cancel"}
          </button>
          {rows && !results && (
            <button
              type="button"
              onClick={() => mutation.mutate()}
              disabled={validEntries.length === 0 || mutation.isPending}
              className="flex cursor-pointer items-center gap-2 rounded-brand-sm bg-primary px-4 h-11 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 border-2 border-ink font-bold"
            >
              {mutation.isPending && <Spinner />}
              Send {validEntries.length} {validEntries.length === 1 ? "invite" : "invites"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
