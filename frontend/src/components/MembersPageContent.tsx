"use client";

import { useState } from "react";
import { useActiveMembers } from "@/hooks/useActiveMembers";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useInviteLinks } from "@/hooks/useInviteLinks";
import { usePendingInvitations } from "@/hooks/usePendingInvitations";
import { InviteLinksTab } from "./InviteLinksTab";
import { InvitesTab } from "./InvitesTab";
import { MembersTab } from "./MembersTab";
import { PageTabs } from "./PageTabs";
import { RequireRole } from "./RequireRole";

type MembersPageContentProps = {
  organisationId: string;
};

type MembersPageTab = "members" | "invites" | "links";

const TITLES: Record<MembersPageTab, string> = {
  members: "Members",
  invites: "Invites",
  links: "Invite links",
};

export function MembersPageContent({ organisationId }: MembersPageContentProps) {
  const [tab, setTab] = useState<MembersPageTab>("members");
  // Inviting is admin-only, so a manager gets neither tab nor its data.
  const isAdmin = useIsAdmin();
  // Both lists load up front so each tab can show its count.
  const membersQuery = useActiveMembers(organisationId, { scope: "organisation" });
  const invitationsQuery = usePendingInvitations(organisationId, { enabled: isAdmin });
  const inviteLinksQuery = useInviteLinks(organisationId, { enabled: isAdmin });

  return (
    <RequireRole role="admin">
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold text-primary-dark">
          {TITLES[tab]}
        </h1>

        <PageTabs
          tabs={[
            { key: "members", label: "Members", count: membersQuery.data?.length },
            ...(isAdmin
              ? [
                  { key: "invites" as const, label: "Invites", count: invitationsQuery.data?.length },
                  { key: "links" as const, label: "Invite links", count: inviteLinksQuery.data?.length },
                ]
              : []),
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === "members" && <MembersTab organisationId={organisationId} />}
        {isAdmin && tab === "invites" && <InvitesTab organisationId={organisationId} />}
        {isAdmin && tab === "links" && <InviteLinksTab organisationId={organisationId} />}
      </div>
    </RequireRole>
  );
}
