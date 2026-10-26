import { checkInView } from "@gymdesk/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApi } from "@/lib/api-context";
import { ApiError } from "@/lib/api";

interface CheckInTarget {
  id: string;
  name: string;
}

function timeOf(isoInstant: string): string {
  return new Date(isoInstant).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function useCheckIn() {
  const api = useApi();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (target: CheckInTarget) =>
      api.post(checkInView, `/api/members/${target.id}/check-ins`),
    onSuccess: (visit, target) => {
      toast.success(`${target.name} checked in`, {
        description: `Arrived at ${timeOf(visit.checkedInAt)}`,
      });
      void queryClient.invalidateQueries({ queryKey: ["check-ins"] });
      void queryClient.invalidateQueries({ queryKey: ["members", target.id] });
    },
    onError: (error, target) => {
      toast.error(`${target.name} was not checked in`, {
        description: error instanceof ApiError ? error.message : "Something went wrong. Try again.",
      });
    },
  });

  return { checkIn: mutation.mutate, isPending: mutation.isPending };
}
