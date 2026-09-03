"use client";

import { useState } from "react";
import { useDevices } from "@/hooks/useDevices";
import type { DeviceStatus } from "@/types/device";
import { DeviceRow } from "./DeviceRow";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

type DevicesTableProps = {
  organisationId: string;
};

const STATUS_FILTERS: (DeviceStatus | "all")[] = [
  "all",
  "active",
  "offline",
  "signed_out",
];

export function DevicesTable({ organisationId }: DevicesTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DeviceStatus | "all">("all");
  const devicesQuery = useDevices(organisationId);

  if (devicesQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading devices…
      </p>
    );
  }

  if (devicesQuery.isError || !devicesQuery.data) {
    return (
      <ErrorMessage
        message={
          devicesQuery.error instanceof Error
            ? devicesQuery.error.message
            : "Could not load devices."
        }
      />
    );
  }

  const search_ = search.trim().toLowerCase();
  const devices = devicesQuery.data.filter((device) => {
    if (statusFilter !== "all" && device.status !== statusFilter) {
      return false;
    }
    if (!search_) {
      return true;
    }
    return [device.userName, device.userEmail, device.platform]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(search_));
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label htmlFor="device-search" className="sr-only">
          Search devices
        </label>
        <input
          id="device-search"
          type="search"
          placeholder="Search by name, email, or platform"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded-md border border-input-border px-3 py-2 text-sm text-slate-900 sm:w-64"
        />
        <label htmlFor="device-status-filter" className="sr-only">
          Filter by status
        </label>
        <select
          id="device-status-filter"
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as DeviceStatus | "all")
          }
          className="rounded-md border border-input-border px-3 py-2 text-sm text-slate-900"
        >
          {STATUS_FILTERS.map((status) => (
            <option key={status} value={status}>
              {status === "all" ? "All statuses" : status.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-md border border-input-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-input-border text-slate-900">
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Platform</th>
              <th className="px-3 py-2 font-medium">App version</th>
              <th className="px-3 py-2 font-medium">Last seen</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <DeviceRow
                key={device.id}
                organisationId={organisationId}
                device={device}
              />
            ))}
            {devices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-slate-900">
                  {devicesQuery.data.length === 0
                    ? "No devices yet. A device appears here automatically the first time someone logs into the desktop or mobile app."
                    : "No devices match your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
