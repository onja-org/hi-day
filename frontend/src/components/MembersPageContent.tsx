"use client";

import { useState } from "react";
import { useActiveMembers } from "@/hooks/useActiveMembers";
import { useInviteLinks } from "@/hooks/useInviteLinks";
import { usePendingInvitations } from "@/hooks/usePendingInvitations";
import { InviteLinksTab } from "./InviteLinksTab";
import { InvitesTab } from "./InvitesTab";
import { MembersTab } from "./MembersTab";
import { PageTabs } from "./PageTabs";
import { RequireRole } from "./RequireRole";
import { SeatsExceededBanner } from "./SeatsExceededBanner";

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
  // Both lists load up front so each tab can show its count.
  const membersQuery = useActiveMembers(organisationId);
  const invitationsQuery = usePendingInvitations(organisationId);
  const inviteLinksQuery = useInviteLinks(organisationId);

  return (
    <RequireRole role={["admin", "manager"]}>
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold text-primary-dark">
          {TITLES[tab]}
        </h1>

        {/* Above the tabs rather than inside one: it is true of the whole
            page, and adding people is what both Members and Invites do. */}
        <SeatsExceededBanner organisationId={organisationId} />

        <PageTabs
          tabs={[
            { key: "members", label: "Members", count: membersQuery.data?.length },
            { key: "invites", label: "Invites", count: invitationsQuery.data?.length },
            { key: "links", label: "Invite links", count: inviteLinksQuery.data?.length },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === "members" && <MembersTab organisationId={organisationId} />}
        {tab === "invites" && <InvitesTab organisationId={organisationId} />}
        {tab === "links" && <InviteLinksTab organisationId={organisationId} />}
      </div>
    </RequireRole>
  );
}
