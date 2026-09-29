"use client";

import { useState } from "react";
import { useActiveMembers } from "@/hooks/useActiveMembers";
import { usePendingInvitations } from "@/hooks/usePendingInvitations";
import { InvitesTab } from "./InvitesTab";
import { MembersTab } from "./MembersTab";
import { PageTabs } from "./PageTabs";
import { RequireRole } from "./RequireRole";

type MembersPageContentProps = {
  organisationId: string;
};

type MembersPageTab = "members" | "invites";

export function MembersPageContent({ organisationId }: MembersPageContentProps) {
  const [tab, setTab] = useState<MembersPageTab>("members");
  // Both lists load up front so each tab can show its count.
  const membersQuery = useActiveMembers(organisationId);
  const invitationsQuery = usePendingInvitations(organisationId);

  return (
    <RequireRole role={["admin", "manager"]}>
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold text-primary-dark">
          {tab === "members" ? "Members" : "Invites"}
        </h1>

        <PageTabs
          tabs={[
            { key: "members", label: "Members", count: membersQuery.data?.length },
            { key: "invites", label: "Invites", count: invitationsQuery.data?.length },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === "members" && <MembersTab organisationId={organisationId} />}
        {tab === "invites" && <InvitesTab organisationId={organisationId} />}
      </div>
    </RequireRole>
  );
}
