import { reminderPage, reminderView, scanResult } from "@gymdesk/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api-context";

export const reminderKeys = { all: ["reminders"] as const };

export interface ReminderFilter {
  status?: "pending" | "sent" | "failed" | undefined;
  kind?: "expiry" | "promo" | undefined;
  offset: number;
  limit: number;
}

export function useReminders(filter: ReminderFilter) {
  const api = useApi();
  return useQuery({
    queryKey: [...reminderKeys.all, "list", filter],
    queryFn: () =>
      api.get(reminderPage, "/api/reminders", {
        status: filter.status,
        kind: filter.kind,
        offset: filter.offset,
        limit: filter.limit,
      }),
    placeholderData: keepPreviousData,
  });
}

export function useRetryReminder() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.post(reminderView, `/api/reminders/${id}/retry`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: reminderKeys.all }),
  });
}

export function useSendReminder() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { memberId: string; kind: "expiry" | "promo" }) =>
      api.post(reminderView, `/api/members/${input.memberId}/reminders`, { kind: input.kind }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: reminderKeys.all }),
  });
}

export function useRunScan() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post(scanResult, "/api/reminders/scan"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: reminderKeys.all }),
  });
}
