"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DEVICES_QUERY_KEY } from "@/hooks/useDevices";
import { devicePlatformLabel } from "@/lib/devicePlatformLabel";
import { signOutDevice } from "@/lib/signOutDevice";
import type { Device, DevicePlatform } from "@/types/device";
import { CaptureBadge } from "./CaptureBadge";
import { DeviceStatusBadge } from "./DeviceStatusBadge";

type DeviceRowProps = {
  organisationId: string;
  device: Device;
};

function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) {
    return "Never";
  }
  return new Date(lastSeenAt).toLocaleString();
}

/** Only the desktop agent records apps and websites, so a phone has nothing to report. */
function isMobile(platform: DevicePlatform): boolean {
  return platform === "ios" || platform === "android";
}

export function DeviceRow({ organisationId, device }: DeviceRowProps) {
  const queryClient = useQueryClient();

  const signOutMutation = useMutation({
    mutationFn: () => signOutDevice(organisationId, device.id),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: DEVICES_QUERY_KEY(organisationId),
      }),
  });

  return (
    <tr className="border-b border-input-border last:border-b-0">
      <td className="px-3 py-2 text-slate-900">
        {device.userName ?? device.userEmail}
        {device.userName && (
          <span className="block text-xs text-slate-900/70">{device.userEmail}</span>
        )}
      </td>
      <td className="px-3 py-2">
        <DeviceStatusBadge status={device.status} />
      </td>
      <td className="px-3 py-2 text-slate-900">
        {devicePlatformLabel(device.platform)}
        {device.osVersion ? ` (${device.osVersion})` : ""}
        {device.displaySession && (
          <span className="block text-xs text-slate-900/70">{device.displaySession}</span>
        )}
      </td>
      <td className="px-3 py-2 text-slate-900">
        {isMobile(device.platform) ? (
          "—"
        ) : (
          <div className="flex flex-col gap-2">
            <CaptureBadge
              label="Apps"
              status={device.appCaptureStatus}
              detail={device.appCaptureDetail}
            />
            <CaptureBadge
              label="Websites"
              status={device.urlCaptureStatus}
              detail={device.urlCaptureDetail}
            />
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-slate-900">{device.appVersion ?? "—"}</td>
      <td className="px-3 py-2 text-slate-900">{formatLastSeen(device.lastSeenAt)}</td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        {device.status !== "signed_out" && (
          <button
            type="button"
            onClick={() => signOutMutation.mutate()}
            disabled={signOutMutation.isPending}
            className="cursor-pointer text-error underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            Sign out
          </button>
        )}
      </td>
    </tr>
  );
}
