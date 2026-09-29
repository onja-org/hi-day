import type { ProjectImportRow } from "@/lib/parseProjectImportRows";

type ProjectImportPreviewTableProps = {
  rows: ProjectImportRow[];
};

function describe(row: ProjectImportRow): string {
  const input = row.input!;
  const teams = input.teamIds?.length ?? 0;
  const members = input.members?.length ?? 0;
  return [
    input.colour,
    teams > 0 && `${teams} ${teams === 1 ? "team" : "teams"}`,
    members > 0 && `${members} ${members === 1 ? "member" : "members"}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function ProjectImportPreviewTable({ rows }: ProjectImportPreviewTableProps) {
  return (
    <div className="max-h-72 overflow-y-auto rounded-md border border-input-border">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-input-border text-primary-dark">
            <th className="px-3 py-2 font-semibold">Line</th>
            <th className="px-3 py-2 font-semibold">Name</th>
            <th className="px-3 py-2 font-semibold">Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.line} className="border-b border-input-border last:border-b-0">
              <td className="px-3 py-2 text-slate-900/70 tabular-nums">{row.line}</td>
              <td className="px-3 py-2 text-slate-900">{row.name || "—"}</td>
              <td className="px-3 py-2">
                {row.input ? (
                  <span className="text-slate-900 capitalize">{describe(row)}</span>
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
