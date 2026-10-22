import type { PlateTone } from "@/lib/plates";
import { fillOf } from "@/features/workouts/capacity";

export interface StudioLoad {
  id: string;
  name: string;
  workouts: number;
  reserved: number;
  capacity: number;
  ratio: number;
  tone: PlateTone;
  summary: string;
}

interface StudioLike {
  id: string;
  name: string;
  archived: boolean;
}

interface WorkoutLike {
  studioId: string;
  reserved: number;
  capacity: number;
  cancelled: boolean;
}

export function studioLoads(
  studios: readonly StudioLike[],
  workouts: readonly WorkoutLike[],
): StudioLoad[] {
  return studios
    .filter((studio) => !studio.archived)
    .map((studio) => {
      const own = workouts.filter(
        (workout) => workout.studioId === studio.id && !workout.cancelled,
      );
      const reserved = own.reduce((sum, workout) => sum + workout.reserved, 0);
      const capacity = own.reduce((sum, workout) => sum + workout.capacity, 0);

      if (own.length === 0) {
        return {
          id: studio.id,
          name: studio.name,
          workouts: 0,
          reserved: 0,
          capacity: 0,
          ratio: 0,
          tone: "neutral" as const,
          summary: "No workouts today",
        };
      }

      return {
        id: studio.id,
        name: studio.name,
        workouts: own.length,
        reserved,
        capacity,
        ratio: Math.min(reserved / capacity, 1),
        tone: fillOf(reserved, capacity).tone,
        summary: `${reserved} of ${capacity} places booked`,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
