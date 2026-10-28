import { workoutListItem, workoutView } from "@gymdesk/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useApi } from "@/lib/api-context";

export const workoutKeys = { all: ["workouts"] as const };

export interface WorkoutFilter {
  from: string;
  to: string;
  studioId?: string | undefined;
  coachId?: string | undefined;
}

export function useWorkouts(filter: WorkoutFilter) {
  const api = useApi();
  return useQuery({
    queryKey: [...workoutKeys.all, "list", filter],
    queryFn: () =>
      api.get(z.array(workoutListItem), "/api/workouts", {
        from: filter.from,
        to: filter.to,
        studioId: filter.studioId,
        coachId: filter.coachId,
      }),
  });
}

export function useWorkout(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: [...workoutKeys.all, "detail", id],
    queryFn: () => api.get(workoutView, `/api/workouts/${id}`),
  });
}

export function useReserve(workoutId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) =>
      api.post(workoutView, `/api/workouts/${workoutId}/reservations`, { memberId }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: workoutKeys.all }),
  });
}

export function useCancelReservation(workoutId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reservationId: string) =>
      api.post(workoutView, `/api/workouts/${workoutId}/reservations/${reservationId}/cancel`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: workoutKeys.all }),
  });
}

export function useCancelWorkout(workoutId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post(workoutView, `/api/workouts/${workoutId}/cancel`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: workoutKeys.all }),
  });
}
