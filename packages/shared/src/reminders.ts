import { z } from "zod";
import { id, isoDate } from "./primitives.js";

export const reminderKind = z.enum(["expiry", "promo"]);
export const reminderStatus = z.enum(["pending", "sent", "failed"]);
export const reminderTrigger = z.enum(["scan", "manual"]);

export const reminderView = z.object({
  id,
  memberId: id,
  memberName: z.string(),
  subscriptionId: id.nullable(),
  kind: reminderKind,
  trigger: reminderTrigger,
  email: z.string(),
  status: reminderStatus,
  attempts: z.number().int().min(0),
  error: z.string().nullable(),
  createdAt: z.iso.datetime(),
  sentAt: z.iso.datetime().nullable(),
});

export const reminderQuery = z.object({
  status: reminderStatus.optional(),
  kind: reminderKind.optional(),
  memberId: id.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export const reminderPage = z.object({
  items: z.array(reminderView),
  total: z.number().int().min(0),
});

export const manualReminder = z.object({ kind: reminderKind });

export const scanResult = z.object({
  date: isoDate,
  considered: z.number().int().min(0),
  sent: z.number().int().min(0),
  failed: z.number().int().min(0),
  skipped: z.number().int().min(0),
});

export type ReminderView = z.infer<typeof reminderView>;
export type ReminderPage = z.infer<typeof reminderPage>;
export type ScanResult = z.infer<typeof scanResult>;
