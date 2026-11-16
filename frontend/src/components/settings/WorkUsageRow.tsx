import { SelectField } from "@/components/ui/form/SelectField";
import { formatElapsed } from "@/lib/formatElapsed";
import type { WorkLabelChoice, WorkUsageItem } from "@/types/workClassification";

type WorkUsageRowProps = {
  item: WorkUsageItem;
  onLabel: (label: WorkLabelChoice) => void;
};

/** One app or site: its name, how much tracked time it had, and its label. */
export function WorkUsageRow({ item, onLabel }: WorkUsageRowProps) {
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-slate-900" title={item.name}>
          {item.name}
        </span>
        <span className="text-xs text-slate-900/60">
          {item.kind === "app" ? "App" : "Website"} ·{" "}
          <span className="font-data tabular-nums">{formatElapsed(item.secondsSpent * 1000)}</span>
        </span>
      </div>
      <SelectField
        label={`Label for ${item.name}`}
        hideLabel
        compact
        className="sm:w-44 sm:shrink-0"
        value={item.label}
        onChange={(event) => onLabel(event.target.value as WorkLabelChoice)}
      >
        <option value="core">Core</option>
        <option value="non_core">Non-core</option>
        <option value="unclassified">Unclassified</option>
      </SelectField>
    </li>
  );
}
