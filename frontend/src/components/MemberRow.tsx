import { formatMembershipRole } from "@/lib/formatMembershipRole";
import { formatShortDate } from "@/lib/formatShortDate";
import { getInitials } from "@/lib/getInitials";
import type { ActiveMemberListItem, MembershipRole } from "@/types/membership";
import { useProjectsEnabled } from "@/hooks/useProjectsEnabled";
import { AvatarStack } from "./AvatarStack";
import { MemberRowActions } from "./MemberRowActions";

type MemberRowProps = {
  organisationId: string;
  member: ActiveMemberListItem;
  /** Team id → name, for the Teams column. A manager's lookup only covers
   * their own teams, so an unknown id falls back to a generic label. */
  teamNames: Map<string, string>;
  callerRole: MembershipRole;
  callerUserId: string;
};

export function MemberRow({
  organisationId,
  member,
  teamNames,
  callerRole,
  callerUserId,
}: MemberRowProps) {
  const projectsEnabled = useProjectsEnabled();
  const isSelf = member.userId === callerUserId;

  return (
    <tr className="border-b border-input-border last:border-b-0 hover:bg-cream/30">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white"
          >
            {getInitials(member.name, member.email)}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="flex items-center gap-2 font-medium text-primary">
              <span className="truncate">{member.name ?? member.email}</span>
              {isSelf && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  You
                </span>
              )}
            </span>
            {member.name && (
              <span className="truncate text-xs text-slate-900/70">{member.email}</span>
            )}
          </span>
        </div>
      </td>
      <td className="hidden px-4 py-3 text-slate-900 lg:table-cell">Active</td>
      <td className="hidden px-4 py-3 text-slate-900 sm:table-cell">
        {formatMembershipRole(member.role)}
      </td>
      {projectsEnabled && (
        <td className="hidden px-4 py-3 text-slate-900 md:table-cell">{member.projectIds.length}</td>
      )}
      <td className="hidden px-4 py-3 md:table-cell">
        <AvatarStack
          tone="secondary"
          items={member.teamIds.map((teamId) => {
            const name = teamNames.get(teamId) ?? "Team";
            return { id: teamId, label: name, initials: getInitials(name).charAt(0) };
          })}
        />
      </td>
      <td className="hidden px-4 py-3 whitespace-nowrap text-slate-900 lg:table-cell">
        {formatShortDate(member.joinedAt)}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <MemberRowActions
          organisationId={organisationId}
          member={member}
          callerRole={callerRole}
          isSelf={isSelf}
        />
      </td>
    </tr>
  );
}
