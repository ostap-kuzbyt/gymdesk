import type { NewStudioInput, StudioView } from "@gymdesk/shared";
import { z } from "zod";

export const studioFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter a name of at least 2 characters")
    .max(60, "Keep the name under 60 characters"),
  capacity: z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter a whole number of people")
    .refine((value) => Number(value) >= 1 && Number(value) <= 500, "Use between 1 and 500 people"),
});

export type StudioFormValues = z.infer<typeof studioFormSchema>;

export function toStudioInput(values: StudioFormValues): NewStudioInput {
  return { name: values.name.trim(), capacity: Number(values.capacity) };
}

export function formValuesOf(studio: StudioView): StudioFormValues {
  return { name: studio.name, capacity: String(studio.capacity) };
}

export const emptyStudioForm: StudioFormValues = { name: "", capacity: "" };
