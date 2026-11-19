import { useQuery } from "@tanstack/react-query";
import { getTwoFactorStatus } from "@/lib/twoFactorApi";

export const TWO_FACTOR_STATUS_QUERY_KEY = ["profile", "me", "two-factor"];

export function useTwoFactorStatus() {
  return useQuery({
    queryKey: TWO_FACTOR_STATUS_QUERY_KEY,
    queryFn: async () => {
      const result = await getTwoFactorStatus();
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.status;
    },
  });
}
