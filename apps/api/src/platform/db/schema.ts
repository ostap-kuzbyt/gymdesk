import { sql } from "drizzle-orm";
import {
  boolean,
  check,
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
