import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { detectTimezone } from "@/lib/timezone";
import { updateMyProfile } from "@/lib/updateMyProfile";

/**
 * Tells the server which timezone this browser is in, whenever it differs
 * from what is stored.
 *
 * Recorded rather than asked for: a profile setting nobody fills in is a
 * setting nobody has, and the timesheet's "read this in their local time"
 * only works if everyone's zone is known. Fire-and-forget — a failure just
 * means the stored zone stays as it was.
 */
export function useReportTimezone(storedTimezone: string | null | undefined): void {
  const { mutate } = useMutation({
    mutationFn: (timezone: string) => updateMyProfile({ timezone }),
  });

  useEffect(() => {
    // undefined means the profile has not loaded yet — only a real null says
    // "nothing recorded".
    if (storedTimezone === undefined) return;
    const detected = detectTimezone();
    if (detected && detected !== storedTimezone) {
      mutate(detected);
    }
  }, [storedTimezone, mutate]);
}
