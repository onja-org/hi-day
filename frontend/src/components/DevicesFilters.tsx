import { MagnifyingGlass } from "@phosphor-icons/react";
import type { DeviceStatus } from "@/types/device";
import { Label } from "@/components/ui/form/Label";
import { SelectField } from "@/components/ui/form/SelectField";

const STATUS_FILTERS: (DeviceStatus | "all")[] = [
  "all",
  "active",
  "offline",
  "signed_out",
];

type DevicesFiltersProps = {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: DeviceStatus | "all";
  onStatusFilterChange: (value: DeviceStatus | "all") => void;
};

export function DevicesFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}: DevicesFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex flex-col gap-1.5 sm:w-64">
        <Label>Search devices</Label>
        <div className="relative flex items-center">
          <MagnifyingGlass
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-4 text-icon"
          />
          <input
            type="search"
            placeholder="Search by name, email, or platform"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-11 w-full rounded-brand-sm border-2 border-ink bg-white pr-4 pl-10 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </label>
      <SelectField
        label="Filter by status"
        compact
        value={statusFilter}
        onChange={(event) =>
          onStatusFilterChange(event.target.value as DeviceStatus | "all")
        }
      >
        {STATUS_FILTERS.map((status) => (
          <option key={status} value={status}>
            {status === "all" ? "All statuses" : status.replace("_", " ")}
          </option>
        ))}
      </SelectField>
    </div>
  );
}
