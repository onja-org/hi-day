import clsx from "clsx";
import type { InviteEntryResult } from "@/types/invitation";

type InviteResultsListProps = {
  results: InviteEntryResult[];
};

function outcomeLabel(result: InviteEntryResult): string {
  switch (result.outcome) {
    case "sent":
      return "Invitation sent";
    case "resent":
      return "Invitation resent";
    case "already_member":
      return result.message ?? "Already a member";
    case "invalid":
      return result.message ?? "Invalid email";
  }
}

export function InviteResultsList({ results }: InviteResultsListProps) {
  return (
    <ul className="flex flex-col gap-1.5 rounded-md border border-input-border p-3 text-sm text-slate-900">
      {results.map((result) => (
        <li key={result.email} className="flex flex-col justify-between gap-2">
          <span>{result.email}</span>
          <span
            className={clsx(
              (result.outcome === "sent" || result.outcome === "resent") &&
                "text-success",
              (result.outcome === "already_member" ||
                result.outcome === "invalid") &&
                "text-error",
            )}
          >
            {outcomeLabel(result)}
          </span>
        </li>
      ))}
    </ul>
  );
}
