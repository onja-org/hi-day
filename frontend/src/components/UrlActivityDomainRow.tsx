"use client";

import { useState } from "react";
import { MinusIcon, PlusIcon } from "@phosphor-icons/react";
import { useProjects } from "@/hooks/useProjects";
import { formatElapsed } from "@/lib/formatElapsed";
import type { UrlSessionDomainGroup } from "@/lib/groupUrlSessionsByDomain";

type UrlActivityDomainRowProps = {
  organisationId: string;
  projectId: string | null;
  domain: UrlSessionDomainGroup;
};

/**
 * One project+domain row of the URLs table (Hubstaff's URLs view is the
 * layout reference) — expands into a nested table of the individual
 * tracked pages on that domain.
 */
export function UrlActivityDomainRow({
  organisationId,
  projectId,
  domain,
}: UrlActivityDomainRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  // `status: "all"` so a since-archived project still resolves for older activity.
  const projectsQuery = useProjects(organisationId, { status: "all" });
  const project = projectId
    ? projectsQuery.data?.find((candidate) => candidate.id === projectId)
    : undefined;

  return (
    <>
      <tr className="border-b border-input-border last:border-b-0">
        <td className="px-3 py-3">
          <button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            aria-expanded={isOpen}
            className="flex w-full cursor-pointer items-center gap-2 text-left"
          >
            {isOpen ? (
              <MinusIcon
                size={14}
                aria-hidden="true"
                className="shrink-0 text-primary"
              />
            ) : (
              <PlusIcon
                size={14}
                aria-hidden="true"
                className="shrink-0 text-primary"
              />
            )}
            {project ? (
              <span className="text-slate-900">{project.name}</span>
            ) : (
              <span className="text-slate-900/50">Untracked</span>
            )}
          </button>
        </td>
        <td className="px-3 py-3 text-slate-900">
          <span className="truncate">{domain.domain}</span>
        </td>
        <td className="px-3 py-3 text-right tabular-nums text-slate-900">
          {formatElapsed(domain.totalActiveMs)}
        </td>
      </tr>

      {isOpen && (
        <tr className="border-b border-input-border last:border-b-0">
          <td colSpan={3} className="px-3 py-3">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-input-border text-slate-900/70">
                  <th className="px-2 py-2 font-medium">Title</th>
                  <th className="px-2 py-2 font-medium">URL</th>
                  <th className="px-2 py-2 text-right font-medium">
                    Time spent
                  </th>
                </tr>
              </thead>
              <tbody>
                {domain.pages.map((page) => (
                  <tr
                    key={page.url}
                    className="border-b border-input-border last:border-b-0"
                  >
                    <td className="max-w-0 truncate px-2 py-2 text-slate-900">
                      {page.title ?? "—"}
                    </td>
                    <td className="max-w-0 truncate px-2 py-2">
                      <a
                        href={page.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {page.url}
                      </a>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-900">
                      {formatElapsed(page.totalActiveMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}
