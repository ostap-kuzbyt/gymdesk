import { memberPage, memberView, visitPage } from "@gymdesk/shared";
import type { MemberView, NewMemberInput } from "@gymdesk/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api-context";

export const memberKeys = {
  all: ["members"] as const,
  list: (q: string, offset: number, limit: number) =>
    ["members", "list", { q, offset, limit }] as const,
  detail: (id: string) => ["members", "detail", id] as const,
};

export function useMemberSearch(options: { q: string; offset: number; limit: number }) {
  const api = useApi();
  return useQuery({
    queryKey: memberKeys.list(options.q, options.offset, options.limit),
    queryFn: () =>
      api.get(memberPage, "/api/members", {
        q: options.q,
        limit: options.limit,
        offset: options.offset,
      }),
    placeholderData: keepPreviousData,
  });
}

export function useRegisterMember() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: NewMemberInput) => api.post(memberView, "/api/members", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: memberKeys.all }),
  });
}

export function useMember(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: memberKeys.detail(id),
    queryFn: () => api.get(memberView, `/api/members/${id}`),
  });
}

export function useVisits(id: string, offset: number, limit: number) {
  const api = useApi();
  return useQuery({
    queryKey: ["check-ins", id, { offset, limit }],
    queryFn: () => api.get(visitPage, `/api/members/${id}/check-ins`, { limit, offset }),
    placeholderData: keepPreviousData,
  });
}

export function useUpdateMember(member: MemberView) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (changes: Record<string, unknown>) =>
      api.patch(memberView, `/api/members/${member.id}`, { ...changes, version: member.version }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: memberKeys.all }),
  });
}

export function useAssignCoach(memberId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (coachId: string | null) =>
      api.put(memberView, `/api/members/${memberId}/coach`, { coachId }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: memberKeys.all }),
  });
}

export function useSellSubscription(memberId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { tariffId: string; startsOn: string }) =>
      api.post(memberView, `/api/members/${memberId}/subscriptions`, input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: memberKeys.all }),
  });
}

export function useCancelSubscription(memberId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (subscriptionId: string) =>
      api.post(memberView, `/api/members/${memberId}/subscriptions/${subscriptionId}/cancel`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: memberKeys.all }),
  });
}

export function useExpiringMembers(withinDays: number) {
  const api = useApi();
  return useQuery({
    queryKey: [...memberKeys.all, "expiring", withinDays],
    queryFn: () =>
      api.get(memberPage, "/api/members", { expiringWithinDays: withinDays, limit: 50, offset: 0 }),
  });
}
