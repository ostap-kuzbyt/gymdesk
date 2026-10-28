import { workoutListItem } from "@gymdesk/shared";
import { useQuery } from "@tanstack/react-query";
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
