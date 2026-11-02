"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import type { InviteEntryResult } from "@/types/invitation";

type InviteResultsListProps = {
  results: InviteEntryResult[];
};

function outcomeLabel(result: InviteEntryResult): string {
  switch (result.outcome) {
    case "sent":
      // No email left the server, so saying "sent" would be a lie — and the
      // admin would never look for the link they now have to pass on.
      return result.acceptUrl ? "Invitation created" : "Invitation sent";
    case "resent":
      return result.acceptUrl ? "New link created" : "Invitation resent";
    case "already_member":
      return result.message ?? "Already a member";
    case "invalid":
      return result.message ?? "Invalid email";
  }
}

/**
 * The join link, for an installation that cannot email it.
 *
 * Shown in full rather than hidden behind the button alone: clipboard
 * access is blocked in some browsers and over plain HTTP, and a link you
 * can read and select by hand still works when copying does not.
 */
function AcceptLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Nothing to do: the link is on screen to be selected by hand.
    }
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-input-border bg-cream/40 p-2.5">
      <p className="text-xs text-slate-900/70">
        No email provider is configured, so nothing was sent. Send this link
        to them yourself — it can only be used once.
      </p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded border border-input-border bg-white px-2 py-1 font-mono text-xs">
          {url}
        </code>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={`Copy the invitation link for this person`}
          className="flex shrink-0 cursor-pointer items-center gap-1 rounded-brand-sm border-2 border-ink bg-white px-2.5 py-1 text-xs font-bold hover:bg-cream"
        >
          {copied ? (
            <CheckIcon size={14} weight="bold" aria-hidden="true" />
          ) : (
            <CopyIcon size={14} weight="bold" aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
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
          {result.acceptUrl && <AcceptLink url={result.acceptUrl} />}
        </li>
      ))}
    </ul>
  );
}
