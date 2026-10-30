import type { CoachView, NewCoachInput } from "@gymdesk/shared";
import { z } from "zod";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const windowSchema = z.object({
  weekday: z.string().regex(/^[1-7]$/, "Pick a day"),
  from: z.string().regex(TIME, "Enter the start time"),
  to: z.string().regex(TIME, "Enter the end time"),
});

export const coachFormSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Enter the coach's full name")
      .max(120, "Keep the name under 120 characters"),
    specialization: z
      .string()
      .trim()
      .min(2, "Enter a specialization")
      .max(80, "Keep it under 80 characters"),
    weeklyHours: z.array(windowSchema).max(21, "Use at most 21 working windows"),
    authSubject: z
      .string()
      .trim()
      .max(255, "Keep it under 255 characters")
      .refine((value) => !/\s/.test(value), "The account ID must not contain spaces")
      .refine((value) => value === "" || value.length >= 3, "The account ID is too short"),
  })
  .superRefine((values, context) => {
    values.weeklyHours.forEach((window, index) => {
      if (TIME.test(window.from) && TIME.test(window.to) && window.from >= window.to) {
        context.addIssue({
          code: "custom",
          path: ["weeklyHours", index, "to"],
          message: "Must end after it starts",
        });
      }
    });

    values.weeklyHours.forEach((window, index) => {
      const earlier = values.weeklyHours.slice(0, index);
      const clash = earlier.some(
        (other) =>
          other.weekday === window.weekday && other.from < window.to && window.from < other.to,
      );
      if (clash && TIME.test(window.from) && TIME.test(window.to)) {
        context.addIssue({
          code: "custom",
          path: ["weeklyHours", index, "from"],
          message: "Overlaps another window on the same day",
        });
      }
    });
  });

export type CoachFormValues = z.infer<typeof coachFormSchema>;

export function toCoachInput(values: CoachFormValues): NewCoachInput {
  return {
    fullName: values.fullName.trim(),
    specialization: values.specialization.trim(),
    weeklyHours: values.weeklyHours.map((window) => ({
      weekday: Number(window.weekday),
      from: window.from,
      to: window.to,
    })),
    authSubject: values.authSubject.trim() === "" ? null : values.authSubject.trim(),
  };
}

export function formValuesOf(coach: CoachView): CoachFormValues {
  return {
    fullName: coach.fullName,
    specialization: coach.specialization,
    weeklyHours: coach.weeklyHours.map((window) => ({
      weekday: String(window.weekday),
      from: window.from,
      to: window.to,
    })),
    authSubject: coach.authSubject ?? "",
  };
}

export const emptyCoachForm: CoachFormValues = {
  fullName: "",
  specialization: "",
  weeklyHours: [],
  authSubject: "",
};
