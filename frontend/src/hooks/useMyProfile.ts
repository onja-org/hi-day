import { useQuery } from "@tanstack/react-query";
import { getMyProfile } from "@/lib/getMyProfile";

export const MY_PROFILE_QUERY_KEY = ["profile", "me"];

export function useMyProfile() {
  return useQuery({
    queryKey: MY_PROFILE_QUERY_KEY,
    queryFn: async () => {
      const result = await getMyProfile();
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.profile;
    },
  });
}
