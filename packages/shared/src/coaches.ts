import { z } from "zod";
import { id } from "./primitives.js";

export const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:MM");

export const workingHours = z.object({
  weekday: z.number().int().min(1).max(7),
  from: timeOfDay,
  to: timeOfDay,
});

const coachFields = z.object({
  fullName: z.string().trim().min(2).max(120),
  specialization: z.string().trim().min(2).max(80),
  weeklyHours: z.array(workingHours).max(21),
});

export const newCoach = coachFields.extend({
  weeklyHours: coachFields.shape.weeklyHours.default([]),
});

export const coachChanges = coachFields.partial().extend({
  version: z.number().int().min(1),
});

export const coachView = coachFields.extend({
  id,
  archived: z.boolean(),
  version: z.number().int().min(1),
});

export const coachAssignment = z.object({ coachId: id.nullable() });

export type WorkingHoursInput = z.infer<typeof workingHours>;
export type NewCoachInput = z.infer<typeof newCoach>;
export type CoachChangesInput = z.infer<typeof coachChanges>;
export type CoachView = z.infer<typeof coachView>;
