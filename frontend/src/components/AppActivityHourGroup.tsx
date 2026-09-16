import { AppWindowIcon } from "@phosphor-icons/react";
import { formatElapsed } from "@/lib/formatElapsed";
import type { AppHourBucket } from "@/types/appActivity";
import { ProjectBadgeOrUntracked } from "./ProjectBadgeOrUntracked";

function formatHourLabel(hourStart: string): string {
  return new Date(hourStart).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

type AppActivityHourGroupProps = {
  organisationId: string;
  bucket: AppHourBucket;
};

/** One hour's app-activity table — bold hour header, then Project/App
 * name/Time spent/Sessions rows, mirroring Hubstaff's hourly grouping with
 * this app's own table styling rather than its exact layout. */
export function AppActivityHourGroup({ organisationId, bucket }: AppActivityHourGroupProps) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-primary-dark">
        {formatHourLabel(bucket.hourStart)}
      </h3>
      <div className="overflow-x-auto rounded-lg border border-input-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-input-border text-slate-900">
              <th className="px-3 py-2 font-medium">Project</th>
              <th className="px-3 py-2 font-medium">App</th>
              <th className="px-3 py-2 text-right font-medium">Time spent</th>
              <th className="px-3 py-2 text-right font-medium">Sessions</th>
            </tr>
          </thead>
          <tbody>
            {bucket.items.map((item, index) => (
              <tr
                key={`${item.projectId ?? "untracked"}-${item.appName}-${index}`}
                className="border-b border-input-border last:border-b-0"
              >
                <td className="px-3 py-2 text-slate-900">
                  <ProjectBadgeOrUntracked
                    organisationId={organisationId}
                    projectId={item.projectId}
                  />
                </td>
                <td className="px-3 py-2 text-slate-900">
                  <span className="flex items-center gap-2">
                    <AppWindowIcon size={16} className="text-primary-dark" aria-hidden="true" />
                    {item.appName}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                  {formatElapsed(item.secondsSpent * 1000)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                  {item.sessionCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
