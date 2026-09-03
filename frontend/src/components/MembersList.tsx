import { ActiveMembersTable } from "./ActiveMembersTable";
import { PendingInvitationsTable } from "./PendingInvitationsTable";

type MembersListProps = {
  organisationId: string;
};

export function MembersList({ organisationId }: MembersListProps) {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-primary-dark">
          Active members
        </h2>
        <ActiveMembersTable organisationId={organisationId} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-primary-dark">
          Pending invitations
        </h2>
        <PendingInvitationsTable organisationId={organisationId} />
      </section>
    </div>
  );
}
