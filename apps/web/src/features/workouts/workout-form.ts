import { isCalendarDate } from "@gymdesk/shared";
import type { NewWorkoutInput } from "@gymdesk/shared";
import { z } from "zod";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export const MIN_MINUTES = 15;
export const MAX_MINUTES = 240;

export function minutesOf(time: string): number {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export const workoutFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "Enter a title of at least 2 characters")
      .max(80, "Keep the title under 80 characters"),
    kind: z.enum(["group", "individual"]),
    studioId: z.string().min(1, "Choose a studio"),
    coachId: z.string().min(1, "Choose a coach"),
    date: z.string().refine((value) => isCalendarDate(value), "Enter the date"),
    startTime: z.string().regex(TIME, "Enter the start time"),
    endTime: z.string().regex(TIME, "Enter the end time"),
    capacity: z
      .string()
      .trim()
      .refine((value) => value === "" || /^\d+$/.test(value), "Enter a whole number of places"),
  })
  .superRefine((values, context) => {
    if (TIME.test(values.startTime) && TIME.test(values.endTime)) {
      const minutes = minutesOf(values.endTime) - minutesOf(values.startTime);
      if (minutes <= 0) {
        context.addIssue({
          code: "custom",
          path: ["endTime"],
          message: "Must end after it starts",
        });
      } else if (minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
        context.addIssue({
          code: "custom",
          path: ["endTime"],
          message: `A workout lasts between ${MIN_MINUTES} minutes and ${MAX_MINUTES / 60} hours`,
        });
      }
    }
    if (values.kind === "group" && values.capacity !== "" && Number(values.capacity) < 2) {
      context.addIssue({
        code: "custom",
        path: ["capacity"],
        message: "A group workout needs at least 2 places",
      });
    }
  });

export type WorkoutFormValues = z.infer<typeof workoutFormSchema>;

export function startProblem(
  values: Pick<WorkoutFormValues, "date" | "startTime">,
  today: string,
  nowTime: string,
): string | undefined {
  if (!isCalendarDate(values.date)) return undefined;
  if (values.date < today) return "The date cannot be in the past";
  if (values.date === today && TIME.test(values.startTime) && values.startTime <= nowTime) {
    return "That time has already passed today";
  }
  return undefined;
}

export function toNewWorkout(values: WorkoutFormValues): NewWorkoutInput {
  return {
    title: values.title.trim(),
    kind: values.kind,
    studioId: values.studioId,
    coachId: values.coachId,
    date: values.date,
    startTime: values.startTime,
    endTime: values.endTime,
    ...(values.kind === "group" && values.capacity !== ""
      ? { capacity: Number(values.capacity) }
      : {}),
  };
}

export function emptyWorkoutForm(today: string): WorkoutFormValues {
  return {
    title: "",
    kind: "group",
    studioId: "",
    coachId: "",
    date: today,
    startTime: "18:00",
    endTime: "19:00",
    capacity: "",
  };
}
