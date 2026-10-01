import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { detectTimezone } from "@/lib/timezone";
import { updateMyProfile } from "@/lib/updateMyProfile";

/**
 * Reports this browser's timezone whenever it differs from the stored one —
 * recorded rather than asked for, since a setting nobody fills in is a
 * setting nobody has. Fire-and-forget: a failure leaves the stored zone.
 */
export function useReportTimezone(storedTimezone: string | null | undefined): void {
  const { mutate } = useMutation({
    mutationFn: (timezone: string) => updateMyProfile({ timezone }),
  });

  useEffect(() => {
    // undefined is "not loaded yet"; only null means nothing recorded.
    if (storedTimezone === undefined) return;
    const detected = detectTimezone();
    if (detected && detected !== storedTimezone) {
      mutate(detected);
    }
  }, [storedTimezone, mutate]);
}
