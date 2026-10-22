import { z } from "zod";

export const id = z.uuid();

export const email = z.string().trim().toLowerCase().pipe(z.email());

export const phone = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Phone must be in international format, for example +380501234567");

export const moneyCents = z.number().int().nonnegative();

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const isoDate = z.string().refine(isCalendarDate, "Date must be a real date as YYYY-MM-DD");

export const dateRange = z
  .object({ from: isoDate, to: isoDate })
  .refine((range) => range.from <= range.to, {
    message: "from must not be after to",
    path: ["to"],
  });

export type DateRange = z.infer<typeof dateRange>;
