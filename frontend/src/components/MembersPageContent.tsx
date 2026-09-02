"use client";

import { useState } from "react";
import { InviteMemberModal } from "./InviteMemberModal";
import { MembersList } from "./MembersList";
import { RequireRole } from "./RequireRole";

type MembersPageContentProps = {
  organisationId: string;
};

export function MembersPageContent({ organisationId }: MembersPageContentProps) {
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-primary-dark">Members</h1>
        <RequireRole role={["admin", "manager"]}>
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="cursor-pointer rounded-md bg-primary px-4 py-2 text-white transition-colors duration-150 hover:bg-primary/90"
          >
            Invite people
          </button>
        </RequireRole>
      </div>

      <RequireRole role={["admin", "manager"]}>
        <MembersList organisationId={organisationId} />
      </RequireRole>

      {inviteOpen && (
        <InviteMemberModal
          organisationId={organisationId}
          onClose={() => setInviteOpen(false)}
        />
      )}
    </div>
  );
}
