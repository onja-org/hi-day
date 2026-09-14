import { useQuery } from "@tanstack/react-query";
import { getDevices } from "@/lib/getDevices";

// Device status is computed server-side from how recently the desktop
// app's own heartbeat last landed (see backend's DEVICE_HEARTBEAT_WINDOW_MINUTES,
// a 5-minute default) — without a refetch interval here, an open Devices
// page never reflects a status flip until the tab regains focus or is
// reloaded, even though the underlying data is now kept fresh (the desktop
// app heartbeats every 60s).
const DEVICES_POLL_INTERVAL_MS = 30_000;

export const DEVICES_QUERY_KEY = (organisationId: string) => [
  "devices",
  organisationId,
];

export function useDevices(organisationId: string) {
  return useQuery({
    queryKey: DEVICES_QUERY_KEY(organisationId),
    queryFn: async () => {
      const result = await getDevices(organisationId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.devices;
    },
    refetchInterval: DEVICES_POLL_INTERVAL_MS,
  });
}
