import { z } from "zod";
import { timeOfDay } from "./coaches.js";
import { id, isoDate } from "./primitives.js";

export const workoutKind = z.enum(["group", "individual"]);

export const newWorkout = z.object({
  title: z.string().trim().min(2).max(80),
  kind: workoutKind,
  studioId: id,
  coachId: id,
  date: isoDate,
  startTime: timeOfDay,
  endTime: timeOfDay,
  capacity: z.number().int().min(1).optional(),
});

export const reservationRequest = z.object({ memberId: id });

export const reservationView = z.object({
  id,
  memberId: id,
  memberName: z.string(),
  reservedAt: z.iso.datetime(),
  cancelledAt: z.iso.datetime().nullable(),
});

export const workoutListItem = z.object({
  id,
  title: z.string(),
  kind: workoutKind,
  studioId: id,
  coachId: id,
  date: isoDate,
  startTime: timeOfDay,
  endTime: timeOfDay,
  capacity: z.number().int(),
  reserved: z.number().int().min(0),
  cancelled: z.boolean(),
});

export const workoutView = workoutListItem.extend({
  spotsLeft: z.number().int().min(0),
  version: z.number().int().min(1),
  reservations: z.array(reservationView),
});

export const workoutQuery = z
  .object({
    from: isoDate,
    to: isoDate,
    studioId: id.optional(),
    coachId: id.optional(),
    includeCancelled: z.stringbool().default(false),
  })
  .refine((query) => query.from <= query.to, { message: "from must not be after to", path: ["to"] })
  .refine((query) => Date.parse(query.to) - Date.parse(query.from) <= 92 * 86_400_000, {
    message: "The range can span at most 92 days",
    path: ["to"],
  });

export type NewWorkoutInput = z.infer<typeof newWorkout>;
export type ReservationView = z.infer<typeof reservationView>;
export type WorkoutListItem = z.infer<typeof workoutListItem>;
export type WorkoutView = z.infer<typeof workoutView>;
