import { coachView, memberPage } from "@gymdesk/shared";
import type { CoachView, NewCoachInput } from "@gymdesk/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export function useCoach(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: [...coachKeys.all, "detail", id],
    queryFn: () => api.get(coachView, `/api/coaches/${id}`),
  });
}

export function useCoachMembers(id: string, offset: number, limit: number) {
  const api = useApi();
  return useQuery({
    queryKey: [...coachKeys.all, "members", id, { offset, limit }],
    queryFn: () => api.get(memberPage, `/api/coaches/${id}/members`, { limit, offset }),
    placeholderData: keepPreviousData,
  });
}

export function useSaveCoach(existing?: CoachView) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: NewCoachInput) =>
      existing
        ? api.patch(coachView, `/api/coaches/${existing.id}`, {
            ...input,
            version: existing.version,
          })
        : api.post(coachView, "/api/coaches", input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: coachKeys.all }),
  });
}

export function useArchiveCoach() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (coach: CoachView) => api.post(coachView, `/api/coaches/${coach.id}/archive`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: coachKeys.all }),
  });
}
