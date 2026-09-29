"use client";

import { useState } from "react";
import { MinusIcon, PlusIcon } from "@phosphor-icons/react";
import { formatElapsed } from "@/lib/formatElapsed";
import type { UrlSessionDomainGroup } from "@/lib/groupUrlSessionsByDomain";
import { Table } from "@/components/ui/table/Table";
import { TableHeader } from "@/components/ui/table/TableHeader";
import { TableBody } from "@/components/ui/table/TableBody";
import { TableRow } from "@/components/ui/table/TableRow";
import { TableHead } from "@/components/ui/table/TableHead";
import { TableCell } from "@/components/ui/table/TableCell";
import { ProjectNameOrUntracked } from "@/components/ProjectNameOrUntracked";

type UrlActivityDomainRowProps = {
  organisationId: string;
  projectId: string | null;
  domain: UrlSessionDomainGroup;
};

export function UrlActivityDomainRow({
  organisationId,
  projectId,
  domain,
}: UrlActivityDomainRowProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <TableRow>
        <TableCell>
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
            <ProjectNameOrUntracked
              organisationId={organisationId}
              projectId={projectId}
            />
          </button>
        </TableCell>
        <TableCell>
          <span className="truncate">{domain.domain}</span>
        </TableCell>
        <TableCell align="right">
          {formatElapsed(domain.totalActiveMs)}
        </TableCell>
      </TableRow>

      {isOpen && (
        <TableRow>
          <TableCell colSpan={3}>
            <Table bare>
              <TableHeader>
                <TableRow>
                  <TableHead size="compact">Title</TableHead>
                  <TableHead size="compact">URL</TableHead>
                  <TableHead size="compact" align="right">
                    Time spent
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domain.pages.map((page) => (
                  <TableRow key={page.url}>
                    <TableCell size="compact" className="max-w-0 truncate">
                      {page.title ?? "—"}
                    </TableCell>
                    <TableCell size="compact" className="max-w-0 truncate">
                      <a
                        href={page.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {page.url}
                      </a>
                    </TableCell>
                    <TableCell size="compact" align="right">
                      {formatElapsed(page.totalActiveMs)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
