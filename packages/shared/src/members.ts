import { z } from "zod";
import { email, id, isoDate, moneyCents, phone } from "./primitives.js";

export const subscriptionStatus = z.enum(["upcoming", "active", "expired", "cancelled"]);

const memberFields = z.object({
  fullName: z.string().trim().min(2).max(120),
  birthDate: isoDate,
  email,
  phone: phone.nullable(),
});

export const newMember = memberFields.extend({
  phone: memberFields.shape.phone.optional(),
});

export const memberChanges = memberFields.partial().extend({
  version: z.number().int().min(1),
});

export const subscriptionView = z.object({
  id,
  tariffId: id,
  startsOn: isoDate,
  endsOn: isoDate,
  priceCents: moneyCents,
  visitLimit: z.number().int().min(1).nullable(),
  cancelledOn: isoDate.nullable(),
  status: subscriptionStatus,
});

export const subscriptionPurchase = z.object({
  tariffId: id,
  startsOn: isoDate.optional(),
});

export const checkInView = z.object({
  id,
  memberId: id,
  subscriptionId: id,
  visitDate: isoDate,
  checkedInAt: z.iso.datetime(),
});

export const visitItem = checkInView.omit({ memberId: true });

export const visitHistoryQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export const visitPage = z.object({
  items: z.array(visitItem),
  total: z.number().int().min(0),
});

export const memberView = memberFields.extend({
  id,
  age: z.number().int(),
  version: z.number().int().min(1),
  subscriptions: z.array(subscriptionView),
});

export const memberListItem = z.object({
  id,
  fullName: z.string(),
  age: z.number().int(),
  email: z.string(),
  phone: z.string().nullable(),
  activeUntil: isoDate.nullable(),
});

export const memberSearch = z.object({
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export const memberPage = z.object({
  items: z.array(memberListItem),
  total: z.number().int().min(0),
});

export type NewMemberInput = z.infer<typeof newMember>;
export type MemberChangesInput = z.infer<typeof memberChanges>;
export type SubscriptionPurchaseInput = z.infer<typeof subscriptionPurchase>;
export type CheckInView = z.infer<typeof checkInView>;
export type VisitPage = z.infer<typeof visitPage>;
export type SubscriptionView = z.infer<typeof subscriptionView>;
export type MemberView = z.infer<typeof memberView>;
export type MemberListItem = z.infer<typeof memberListItem>;
export type MemberPage = z.infer<typeof memberPage>;
