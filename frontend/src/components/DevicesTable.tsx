"use client";

import { useState } from "react";
import { useDevices } from "@/hooks/useDevices";
import { matchesSearch } from "@/lib/matchesSearch";
import { paginateRows } from "@/lib/paginateRows";
import type { DeviceStatus } from "@/types/device";
import { DeviceRow } from "@/components/DeviceRow";
import { DevicesFilters } from "@/components/DevicesFilters";
import { ErrorMessage } from "@/components/ErrorMessage";
import { ReportsTableFooter } from "@/components/reports/ReportsTableFooter";
import { Spinner } from "@/components/Spinner";

type DevicesTableProps = {
  organisationId: string;
};

export function DevicesTable({ organisationId }: DevicesTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DeviceStatus | "all">("all");
  const [perPage, setPerPage] = useState(25);
  const [requestedPage, setRequestedPage] = useState(1);
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

  const devices = devicesQuery.data.filter(
    (device) =>
      (statusFilter === "all" || device.status === statusFilter) &&
      matchesSearch([device.userName, device.userEmail, device.platform], search),
  );
  const pageCount = Math.max(1, Math.ceil(devices.length / perPage));
  // Clamp rather than store, so a page emptied by the 30s refresh (a device
  // signed out, or gone offline under the "active" filter) falls back to the
  // last page that still has devices — while a refresh that leaves the page
  // populated keeps the user where they were.
  const page = Math.min(requestedPage, pageCount);
  const pageDevices = paginateRows(devices, page, perPage);

  return (
    <div className="flex flex-col gap-4">
      <DevicesFilters
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setRequestedPage(1);
        }}
        statusFilter={statusFilter}
        onStatusFilterChange={(value) => {
          setStatusFilter(value);
          setRequestedPage(1);
        }}
      />

      <div className="overflow-x-auto rounded-md border border-input-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-input-border text-slate-900">
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="hidden px-3 py-2 font-medium sm:table-cell">Platform</th>
              <th className="hidden px-3 py-2 font-medium lg:table-cell">Tracking</th>
              <th className="hidden px-3 py-2 font-medium lg:table-cell">App version</th>
              <th className="hidden px-3 py-2 font-medium md:table-cell">Last seen</th>
              <th className="px-3 py-2 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pageDevices.map((device) => (
              <DeviceRow
                key={device.id}
                organisationId={organisationId}
                device={device}
              />
            ))}
            {devices.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-4 text-center text-slate-900"
                >
                  {devicesQuery.data.length === 0
                    ? "No devices yet. A device appears here automatically the first time someone logs into the desktop or mobile app."
                    : "No devices match your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {devices.length > 0 && (
        <ReportsTableFooter
          totalRows={devices.length}
          perPage={perPage}
          onPerPageChange={(value) => {
            setPerPage(value);
            setRequestedPage(1);
          }}
          page={page}
          pageCount={pageCount}
          onPageChange={setRequestedPage}
          showPrevNext
          condensePages={devicesQuery.data.length > 200}
        />
      )}
    </div>
  );
}
