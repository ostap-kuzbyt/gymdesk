import { coachView } from "@gymdesk/shared";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useApi } from "@/lib/api-context";

export const coachKeys = { all: ["coaches"] as const };

export function useCoaches(includeArchived = false) {
  const api = useApi();
  return useQuery({
    queryKey: [...coachKeys.all, { includeArchived }],
    queryFn: () => api.get(z.array(coachView), "/api/coaches", { includeArchived }),
  });
}
