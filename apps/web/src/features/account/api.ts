import { meView } from "@gymdesk/shared";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api-context";

export const meKey = ["me"] as const;

export function useMe(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: meKey,
    queryFn: () => api.get(meView, "/api/me"),
    enabled,
    staleTime: 5 * 60_000,
  });
}
