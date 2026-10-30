"use client";

import { useState } from "react";
import { membersToCsv } from "@/lib/membersToCsv";
import { membersToPdf } from "@/lib/membersToPdf";
import type { ActiveMemberListItem } from "@/types/membership";
import { ActionsMenu } from "./ActionsMenu";
import { ExportButtons } from "./ExportButtons";
import { ImportMembersModal } from "./ImportMembersModal";
import { InviteMemberModal } from "./InviteMemberModal";
import { SearchInput } from "./SearchInput";
import { SendPasswordResetDialog } from "./SendPasswordResetDialog";

type MembersToolbarProps = {
  organisationId: string;
  /** The members currently shown (after search) — what Export and batch actions act on. */
  members: ActiveMemberListItem[];
  teamNames: Map<string, string>;
  callerUserId: string;
  search: string;
  onSearchChange: (value: string) => void;
};

export function MembersToolbar({
  organisationId,
  members,
  teamNames,
  callerUserId,
  search,
  onSearchChange,
}: MembersToolbarProps) {
  const [openModal, setOpenModal] = useState<"invite" | "import" | "reset" | null>(null);
  const close = () => setOpenModal(null);
  // Your own reset goes through "Forgot password", not this batch.
  const resettable = members.filter((member) => member.userId !== callerUserId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchInput value={search} onChange={onSearchChange} placeholder="Search members" />
        <div className="flex flex-wrap items-center gap-3">
          <ExportButtons
            csv={membersToCsv(members, teamNames)}
            buildPdf={() => membersToPdf(members, teamNames)}
            filenameBase={`members-${new Date().toISOString().slice(0, 10)}`}
            disabled={members.length === 0}
          />
          <button
            type="button"
            onClick={() => setOpenModal("import")}
            className="cursor-pointer rounded-brand-sm border-2 border-primary px-4 h-11 text-sm font-semibold text-primary transition-colors duration-150 hover:bg-primary/10"
          >
            Import members
          </button>
          <button
            type="button"
            onClick={() => setOpenModal("invite")}
            className="cursor-pointer rounded-brand-sm bg-primary px-5 h-11 text-sm font-bold text-white transition-colors duration-150 hover:bg-primary/90 border-2 border-ink"
          >
            Add members
          </button>
        </div>
      </div>

      <div className="text-left">
        <ActionsMenu
          label="Batch actions"
          align="left"
          items={[
            {
              label: search.trim()
                ? `Send password reset to ${resettable.length} shown`
                : "Send password reset to everyone",
              onSelect: () => setOpenModal("reset"),
              disabled: resettable.length === 0,
            },
          ]}
        />
      </div>

      {openModal === "invite" && <InviteMemberModal organisationId={organisationId} onClose={close} />}
      {openModal === "import" && <ImportMembersModal organisationId={organisationId} onClose={close} />}
      {openModal === "reset" && (
        <SendPasswordResetDialog
          organisationId={organisationId}
          membershipIds={resettable.map((member) => member.id)}
          recipientLabel={`${resettable.length} ${resettable.length === 1 ? "member" : "members"}`}
          onClose={close}
        />
      )}
    </div>
  );
}
