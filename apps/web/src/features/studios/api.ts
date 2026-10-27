import { studioView } from "@gymdesk/shared";
import type { NewStudioInput, StudioView } from "@gymdesk/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useApi } from "@/lib/api-context";

export const studioKeys = { all: ["studios"] as const };

export function useStudios(includeArchived: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: [...studioKeys.all, { includeArchived }],
    queryFn: () => api.get(z.array(studioView), "/api/studios", { includeArchived }),
  });
}

export function useSaveStudio(existing?: StudioView) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: NewStudioInput) =>
      existing
        ? api.patch(studioView, `/api/studios/${existing.id}`, {
            ...input,
            version: existing.version,
          })
        : api.post(studioView, "/api/studios", input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: studioKeys.all }),
  });
}

export function useArchiveStudio() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (studio: StudioView) => api.post(studioView, `/api/studios/${studio.id}/archive`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: studioKeys.all }),
  });
}
