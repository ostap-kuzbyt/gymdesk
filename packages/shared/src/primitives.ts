import { z } from "zod";

export const id = z.uuid();

export const email = z.string().trim().toLowerCase().pipe(z.email());

export const phone = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Phone must be in international format, for example +380501234567");

export const moneyCents = z.number().int().nonnegative();

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

export const dateRange = z
  .object({ from: isoDate, to: isoDate })
  .refine((range) => range.from <= range.to, {
    message: "from must not be after to",
    path: ["to"],
  });

export type DateRange = z.infer<typeof dateRange>;
