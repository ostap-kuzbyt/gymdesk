import { z } from "zod";
import { id, isoDate } from "./primitives.js";

const DAY_MS = 86_400_000;

function rangeOf(maxDays: number) {
  return z
    .object({ from: isoDate, to: isoDate })
    .refine((range) => range.from <= range.to, {
      message: "from must not be after to",
      path: ["to"],
    })
    .refine((range) => Date.parse(range.to) - Date.parse(range.from) <= maxDays * DAY_MS, {
      message: `The range can span at most ${maxDays} days`,
      path: ["to"],
    });
}

const pageFields = {
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
};

export const attendanceQuery = z
  .object({ from: isoDate, to: isoDate, ...pageFields })
  .refine((query) => query.from <= query.to, { message: "from must not be after to", path: ["to"] })
  .refine((query) => Date.parse(query.to) - Date.parse(query.from) <= 3660 * DAY_MS, {
    message: "The range can span at most 3660 days",
    path: ["to"],
  });

export const revenueQuery = z
  .object({
    from: isoDate,
    to: isoDate,
    granularity: z.enum(["month", "year"]).default("month"),
  })
  .refine((query) => query.from <= query.to, { message: "from must not be after to", path: ["to"] })
  .refine((query) => Date.parse(query.to) - Date.parse(query.from) <= 3660 * DAY_MS, {
    message: "The range can span at most 3660 days",
    path: ["to"],
  });

export const loadQuery = rangeOf(92);

export const attendanceRow = z.object({
  memberId: id,
  fullName: z.string(),
  email: z.string(),
  visits: z.number().int().min(0),
  lastVisitOn: isoDate.nullable(),
  activeUntil: isoDate.nullable(),
});

export const attendanceReport = z.object({
  from: isoDate,
  to: isoDate,
  items: z.array(attendanceRow),
  total: z.number().int().min(0),
});

export const revenueRow = z.object({
  period: z.string(),
  revenueCents: z.number().int().min(0),
  subscriptions: z.number().int().min(0),
});

export const revenueReport = z.object({
  granularity: z.enum(["month", "year"]),
  rows: z.array(revenueRow),
  totalCents: z.number().int().min(0),
  totalSubscriptions: z.number().int().min(0),
});

export const loadRow = z.object({
  date: isoDate,
  id,
  name: z.string(),
  workouts: z.number().int().min(1),
  minutes: z.number().int().min(0),
  reserved: z.number().int().min(0),
  capacity: z.number().int().min(0),
});

export const loadReport = z.object({
  from: isoDate,
  to: isoDate,
  coaches: z.array(loadRow),
  studios: z.array(loadRow),
});

export type AttendanceReport = z.infer<typeof attendanceReport>;
export type RevenueReport = z.infer<typeof revenueReport>;
export type LoadReport = z.infer<typeof loadReport>;
export type LoadRow = z.infer<typeof loadRow>;
