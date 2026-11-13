"use client";

import { useState } from "react";
import { ErrorMessage } from "@/components/ErrorMessage";
import { SegmentedControl } from "@/components/SegmentedControl";
import { SettingsSectionRow } from "@/components/SettingsSectionRow";
import { Spinner } from "@/components/Spinner";
import { TextField } from "@/components/ui/form/TextField";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { useSetWorkLabel } from "@/hooks/useSetWorkLabel";
import { useWorkUsage } from "@/hooks/useWorkUsage";
import { filterWorkUsage } from "@/lib/filterWorkUsage";
import type { WorkUsageFilter } from "@/lib/filterWorkUsage";
import { WorkUsageRow } from "./WorkUsageRow";

const KIND_OPTIONS: { key: WorkUsageFilter["kind"]; label: string }[] = [
  { key: "all", label: "All" },
  { key: "app", label: "Apps" },
  { key: "site", label: "Websites" },
];

/**
 * Settings → Activity & tracking → Work time classification: every app and
 * website used on the timer in the last 30 days, most time first, each
 * labelled core, non-core or unclassified for the whole organisation.
 */
export function WorkClassificationSettings() {
  const organisation = useCurrentOrganisation().data;
  const organisationId = organisation ? String(organisation.id) : "";
  const usageQuery = useWorkUsage(organisationId);
  const setLabel = useSetWorkLabel(organisationId);
  const [kind, setKind] = useState<WorkUsageFilter["kind"]>("all");
  const [unclassifiedOnly, setUnclassifiedOnly] = useState(false);
  const [search, setSearch] = useState("");

  const items = usageQuery.data ?? [];
  const unclassifiedCount = items.filter((item) => item.label === "unclassified").length;
  const shown = filterWorkUsage(items, { kind, label: unclassifiedOnly ? "unclassified" : "all", search });

  return (
    <div className="py-6">
      <SettingsSectionRow
        title="Work time classification"
        description="Label the apps and websites your organisation uses as core work (what the job needs) or non-core. Anything unlabelled counts as unclassified, not non-core. Labels apply to past time too, and feed the Performance page."
      >
        <div className="flex flex-col gap-4 rounded-lg border border-input-border bg-white p-5">
          {(usageQuery.isPending || organisationId === "") && (
            <p className="flex items-center gap-2 text-slate-900">
              <Spinner className="text-primary-dark" />
              Loading…
            </p>
          )}
          {usageQuery.isError && <ErrorMessage message={usageQuery.error.message} />}
          {setLabel.isError && <ErrorMessage message={setLabel.error.message} />}
          {usageQuery.isSuccess && items.length === 0 && (
            <p className="text-sm text-slate-900/60">
              No apps or websites were tracked in the last 30 days. They appear here once members track time with
              app & URL tracking on.
            </p>
          )}
          {usageQuery.isSuccess && items.length > 0 && (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <TextField
                  label="Search"
                  type="search"
                  compact
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="sm:w-56"
                />
                <SegmentedControl label="Show" options={KIND_OPTIONS} value={kind} onChange={setKind} />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-900">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={unclassifiedOnly}
                  onChange={(event) => setUnclassifiedOnly(event.target.checked)}
                />
                Only unclassified ({unclassifiedCount} of {items.length})
              </label>
              {shown.length === 0 ? (
                <p className="text-sm text-slate-900/60">Nothing matches.</p>
              ) : (
                <ul className="divide-y divide-input-border">
                  {shown.map((item) => (
                    <WorkUsageRow
                      key={`${item.kind}:${item.name}`}
                      item={item}
                      onLabel={(label) => setLabel.mutate({ kind: item.kind, name: item.name, label })}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </SettingsSectionRow>
    </div>
  );
}
