import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const tariffs = pgTable(
  "tariffs",
  {
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    priceCents: integer("price_cents").notNull(),
    durationDays: integer("duration_days").notNull(),
    visitLimit: integer("visit_limit"),
    archived: boolean("archived").notNull().default(false),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("tariffs_active_name_unique")
      .on(sql`lower(${table.name})`)
      .where(sql`not ${table.archived}`),
    check("tariffs_price_non_negative", sql`${table.priceCents} >= 0`),
    check("tariffs_duration_in_range", sql`${table.durationDays} between 1 and 732`),
    check(
      "tariffs_visit_limit_positive",
      sql`${table.visitLimit} is null or ${table.visitLimit} >= 1`,
    ),
  ],
);

export const studios = pgTable(
  "studios",
  {
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    capacity: integer("capacity").notNull(),
    archived: boolean("archived").notNull().default(false),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("studios_active_name_unique")
      .on(sql`lower(${table.name})`)
      .where(sql`not ${table.archived}`),
    check("studios_capacity_in_range", sql`${table.capacity} between 1 and 500`),
  ],
);

export const coaches = pgTable("coaches", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name").notNull(),
  specialization: text("specialization").notNull(),
  weeklyHours: jsonb("weekly_hours")
    .$type<{ weekday: number; from: string; to: string }[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  archived: boolean("archived").notNull().default(false),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey(),
    fullName: text("full_name").notNull(),
    birthDate: date("birth_date", { mode: "string" }).notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    coachId: uuid("coach_id").references(() => coaches.id),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("members_email_unique").on(table.email),
    index("members_coach_idx").on(table.coachId),
  ],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    tariffId: uuid("tariff_id")
      .notNull()
      .references(() => tariffs.id),
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    endsOn: date("ends_on", { mode: "string" }).notNull(),
    priceCents: integer("price_cents").notNull(),
    visitLimit: integer("visit_limit"),
    cancelledOn: date("cancelled_on", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("subscriptions_member_idx").on(table.memberId),
    index("subscriptions_ends_on_idx").on(table.endsOn),
    check("subscriptions_dates_ordered", sql`${table.endsOn} >= ${table.startsOn}`),
    check("subscriptions_price_non_negative", sql`${table.priceCents} >= 0`),
    check(
      "subscriptions_visit_limit_positive",
      sql`${table.visitLimit} is null or ${table.visitLimit} >= 1`,
    ),
  ],
);

export const checkIns = pgTable(
  "check_ins",
  {
    id: uuid("id").primaryKey(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }),
    visitDate: date("visit_date", { mode: "string" }).notNull(),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("check_ins_member_day_unique").on(table.memberId, table.visitDate),
    index("check_ins_subscription_idx").on(table.subscriptionId),
    index("check_ins_visit_date_idx").on(table.visitDate),
  ],
);

export const workouts = pgTable(
  "workouts",
  {
    id: uuid("id").primaryKey(),
    title: text("title").notNull(),
    kind: text("kind").notNull(),
    studioId: uuid("studio_id")
      .notNull()
      .references(() => studios.id),
    coachId: uuid("coach_id")
      .notNull()
      .references(() => coaches.id),
    workoutDate: date("workout_date", { mode: "string" }).notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    capacity: integer("capacity").notNull(),
    cancelled: boolean("cancelled").notNull().default(false),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("workouts_date_idx").on(table.workoutDate),
    index("workouts_coach_idx").on(table.coachId),
    check("workouts_kind_known", sql`${table.kind} in ('group', 'individual')`),
    check("workouts_capacity_positive", sql`${table.capacity} >= 1`),
    check("workouts_time_ordered", sql`${table.endTime} > ${table.startTime}`),
  ],
);

export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").primaryKey(),
    workoutId: uuid("workout_id")
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    reservedAt: timestamp("reserved_at", { withTimezone: true }).notNull(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("reservations_active_member_unique")
      .on(table.workoutId, table.memberId)
      .where(sql`${table.cancelledAt} is null`),
    index("reservations_member_idx").on(table.memberId),
  ],
);
