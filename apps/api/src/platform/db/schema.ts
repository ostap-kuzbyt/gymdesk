import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
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

export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey(),
    fullName: text("full_name").notNull(),
    birthDate: date("birth_date", { mode: "string" }).notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("members_email_unique").on(table.email)],
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
