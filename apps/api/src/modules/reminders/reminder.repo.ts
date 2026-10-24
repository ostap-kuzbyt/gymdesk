import { and, count, desc, eq } from "drizzle-orm";
import { reminders } from "../../platform/db/schema.js";
import type { Executor } from "../../platform/db/tx.js";
import { Reminder } from "./reminder.js";
import type { ReminderKind, ReminderStatus, ReminderTrigger } from "./reminder.js";

type ReminderRow = typeof reminders.$inferSelect;

export interface ReminderFilter {
  status?: ReminderStatus | undefined;
  kind?: ReminderKind | undefined;
  memberId?: string | undefined;
  limit: number;
  offset: number;
}

function toEntity(row: ReminderRow): Reminder {
  return Reminder.restore({
    id: row.id,
    memberId: row.memberId,
    subscriptionId: row.subscriptionId,
    kind: row.kind as ReminderKind,
    trigger: row.trigger as ReminderTrigger,
    email: row.email,
    status: row.status as ReminderStatus,
    attempts: row.attempts,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    sentAt: row.sentAt?.toISOString() ?? null,
  });
}

export const reminderRepo = {
  async findById(db: Executor, id: string): Promise<Reminder | undefined> {
    const [row] = await db.select().from(reminders).where(eq(reminders.id, id));
    return row && toEntity(row);
  },

  async findScanExpiry(db: Executor, subscriptionId: string): Promise<Reminder | undefined> {
    const [row] = await db
      .select()
      .from(reminders)
      .where(
        and(
          eq(reminders.subscriptionId, subscriptionId),
          eq(reminders.kind, "expiry"),
          eq(reminders.trigger, "scan"),
        ),
      );
    return row && toEntity(row);
  },

  async insert(db: Executor, reminder: Reminder): Promise<void> {
    const snapshot = reminder.toSnapshot();
    await db.insert(reminders).values({
      ...snapshot,
      createdAt: new Date(snapshot.createdAt),
      sentAt: snapshot.sentAt ? new Date(snapshot.sentAt) : null,
    });
  },

  async save(db: Executor, reminder: Reminder): Promise<void> {
    const { status, attempts, error, sentAt } = reminder.toSnapshot();
    await db
      .update(reminders)
      .set({ status, attempts, error, sentAt: sentAt ? new Date(sentAt) : null })
      .where(eq(reminders.id, reminder.id));
  },

  async list(
    db: Executor,
    filter: ReminderFilter,
  ): Promise<{ reminders: Reminder[]; total: number }> {
    const where = and(
      filter.status ? eq(reminders.status, filter.status) : undefined,
      filter.kind ? eq(reminders.kind, filter.kind) : undefined,
      filter.memberId ? eq(reminders.memberId, filter.memberId) : undefined,
    );

    const rows = await db
      .select()
      .from(reminders)
      .where(where)
      .orderBy(desc(reminders.createdAt), desc(reminders.id))
      .limit(filter.limit)
      .offset(filter.offset);
    const [totals] = await db.select({ total: count() }).from(reminders).where(where);

    return { reminders: rows.map(toEntity), total: totals?.total ?? 0 };
  },
};
