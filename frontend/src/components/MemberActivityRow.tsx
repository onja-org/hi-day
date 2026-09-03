"use client";

import { useMemberActivity } from "@/hooks/useMemberActivity";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

type MemberActivityRowProps = {
  organisationId: string;
  membershipId: string;
  colSpan: number;
};

export function MemberActivityRow({
  organisationId,
  membershipId,
  colSpan,
}: MemberActivityRowProps) {
  const activityQuery = useMemberActivity(organisationId, membershipId, true);

  return (
    <tr className="border-b border-input-border bg-cream/30 last:border-b-0">
      <td colSpan={colSpan} className="px-3 py-3">
        {activityQuery.isLoading && (
          <p className="flex items-center gap-2 text-slate-900">
            <Spinner className="text-primary-dark" />
            Loading activity…
          </p>
        )}

        {activityQuery.isError && (
          <ErrorMessage
            message={
              activityQuery.error instanceof Error
                ? activityQuery.error.message
                : "Could not load activity."
            }
          />
        )}

        {activityQuery.data && (
          <ul className="flex flex-col gap-2">
            {activityQuery.data.map((entry) => (
              <li key={entry.id} className="text-slate-900">
                <p>{entry.content}</p>
                <p className="text-sm text-slate-900/70">
                  {new Date(entry.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
            {activityQuery.data.length === 0 && (
              <li className="text-slate-900">No activity yet.</li>
            )}
          </ul>
        )}
      </td>
    </tr>
  );
}
