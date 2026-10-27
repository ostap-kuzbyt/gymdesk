import { memberPage, memberView } from "@gymdesk/shared";
import type { NewMemberInput } from "@gymdesk/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api-context";

export const memberKeys = {
  all: ["members"] as const,
  list: (q: string, offset: number, limit: number) =>
    ["members", "list", { q, offset, limit }] as const,
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
