import { formatMembershipRole } from "@/lib/formatMembershipRole";
import type { MemberImportRow } from "@/lib/parseMemberImportRows";

type ImportPreviewTableProps = {
  rows: MemberImportRow[];
  teamNames: Map<string, string>;
};

export function ImportPreviewTable({ rows, teamNames }: ImportPreviewTableProps) {
  return (
    <div className="max-h-72 overflow-y-auto rounded-md border border-input-border">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-input-border text-primary-dark">
            <th className="px-3 py-2 font-semibold">Line</th>
            <th className="px-3 py-2 font-semibold">Email</th>
            <th className="px-3 py-2 font-semibold">Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.line} className="border-b border-input-border last:border-b-0">
              <td className="px-3 py-2 text-slate-900/70 tabular-nums">{row.line}</td>
              <td className="px-3 py-2 text-slate-900">{row.email || "—"}</td>
              <td className="px-3 py-2">
                {row.entry ? (
                  <span className="text-slate-900">
                    {formatMembershipRole(row.entry.role)}
                    {row.entry.teamIds &&
                      ` · ${row.entry.teamIds.map((id) => teamNames.get(id) ?? "Team").join(", ")}`}
                    {row.entry.projectIds &&
                      ` · ${row.entry.projectIds.length} ${row.entry.projectIds.length === 1 ? "project" : "projects"}`}
                  </span>
                ) : (
                  <span className="text-error">{row.error}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
