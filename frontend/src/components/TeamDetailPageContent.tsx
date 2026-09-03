import Link from "next/link";
import { RequireRole } from "./RequireRole";
import { TeamDetail } from "./TeamDetail";

type TeamDetailPageContentProps = {
  organisationId: string;
  teamId: string;
};

export function TeamDetailPageContent({
  organisationId,
  teamId,
}: TeamDetailPageContentProps) {
  return (
    <div className="flex flex-col gap-8">
      <Link
        href={`/organisations/${organisationId}/teams`}
        className="text-sm text-slate-900 hover:underline"
      >
        ← Teams
      </Link>

      <RequireRole role="admin">
        <TeamDetail organisationId={organisationId} teamId={teamId} />
      </RequireRole>
    </div>
  );
}
