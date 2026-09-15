"use client";

import { useDisclosureVersionHistory } from "@/hooks/useDisclosureVersionHistory";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

type DisclosureVersionHistoryProps = {
  organisationId: number;
  region: string | null;
};

export function DisclosureVersionHistory({
  organisationId,
  region,
}: DisclosureVersionHistoryProps) {
  const historyQuery = useDisclosureVersionHistory(organisationId, region);

  if (historyQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading version history…
      </p>
    );
  }

  if (historyQuery.isError || !historyQuery.data) {
    return (
      <ErrorMessage
        message={
          historyQuery.error instanceof Error
            ? historyQuery.error.message
            : "Could not load version history."
        }
      />
    );
  }

  const versions = historyQuery.data;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-primary-dark">
        Published versions — {region ? `region ${region}` : "org default"}
      </h2>

      {versions.length === 0 ? (
        <p className="text-slate-900">
          Nothing published for this region yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-input-border">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr className="border-b border-input-border text-slate-900">
                <th className="px-3 py-2 font-medium">Version</th>
                <th className="px-3 py-2 font-medium">Published</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr
                  key={version.id}
                  className="border-b border-input-border last:border-0"
                >
                  <td className="px-3 py-2 text-slate-900">
                    v{version.version}
                  </td>
                  <td className="px-3 py-2 text-slate-900">
                    {new Date(version.publishedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
