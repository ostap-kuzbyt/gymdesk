import { and, asc, count, eq, gte, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { members, subscriptions } from "../../platform/db/schema.js";
import type { Executor } from "../../platform/db/tx.js";
import { ConflictError } from "../../platform/errors.js";
import { Member } from "./member.js";
import type { Subscription } from "./subscription.js";

type SubscriptionRow = typeof subscriptions.$inferSelect;

export interface MemberListRow {
  id: string;
  fullName: string;
  birthDate: string;
  email: string;
  phone: string | null;
  activeUntil: string | null;
}

export interface MemberSearch {
  q: string | undefined;
  limit: number;
  offset: number;
  today: string;
}

function toSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    tariffId: row.tariffId,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    priceCents: row.priceCents,
    visitLimit: row.visitLimit,
    cancelledOn: row.cancelledOn,
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

async function upsertSubscriptions(db: Executor, memberId: string, items: Subscription[]) {
  if (items.length === 0) return;
  await db
    .insert(subscriptions)
    .values(items.map((item) => ({ ...item, memberId })))
    .onConflictDoUpdate({
      target: subscriptions.id,
      set: { cancelledOn: sql`excluded.cancelled_on` },
    });
}

export const memberRepo = {
  async findById(db: Executor, id: string): Promise<Member | undefined> {
    const [row] = await db.select().from(members).where(eq(members.id, id));
    if (!row) return undefined;

    const owned = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.memberId, id))
      .orderBy(asc(subscriptions.startsOn));

    return Member.restore({
      id: row.id,
      fullName: row.fullName,
      birthDate: row.birthDate,
      email: row.email,
      phone: row.phone,
      version: row.version,
      subscriptions: owned.map(toSubscription),
    });
  },

  async insert(db: Executor, member: Member): Promise<void> {
    const { subscriptions: items, version, ...profile } = member.toSnapshot();
    await db.insert(members).values({ ...profile, version });
    await upsertSubscriptions(db, profile.id, items);
  },

  async save(db: Executor, member: Member): Promise<void> {
    const { subscriptions: items, id, version, ...profile } = member.toSnapshot();
    const updated = await db
      .update(members)
      .set({ ...profile, version: version + 1 })
      .where(and(eq(members.id, id), eq(members.version, version)))
      .returning({ id: members.id });

    if (updated.length === 0) {
      throw new ConflictError("The member was changed by someone else, reload and try again");
    }
    await upsertSubscriptions(db, id, items);
  },

  async search(
    db: Executor,
    options: MemberSearch,
  ): Promise<{ rows: MemberListRow[]; total: number }> {
    const pattern = options.q ? `%${escapeLike(options.q)}%` : undefined;
    const filter = pattern
      ? or(
          ilike(members.fullName, pattern),
          ilike(members.email, pattern),
          ilike(members.phone, pattern),
        )
      : undefined;

    const page = await db
      .select({
        id: members.id,
        fullName: members.fullName,
        birthDate: members.birthDate,
        email: members.email,
        phone: members.phone,
      })
      .from(members)
      .where(filter)
      .orderBy(asc(members.fullName), asc(members.id))
      .limit(options.limit)
      .offset(options.offset);

    const [totals] = await db.select({ total: count() }).from(members).where(filter);

    const current =
      page.length === 0
        ? []
        : await db
            .select({ memberId: subscriptions.memberId, endsOn: subscriptions.endsOn })
            .from(subscriptions)
            .where(
              and(
                inArray(
                  subscriptions.memberId,
                  page.map((row) => row.id),
                ),
                isNull(subscriptions.cancelledOn),
                lte(subscriptions.startsOn, options.today),
                gte(subscriptions.endsOn, options.today),
              ),
            );
    const activeUntil = new Map(current.map((row) => [row.memberId, row.endsOn]));

    return {
      rows: page.map((row) => ({ ...row, activeUntil: activeUntil.get(row.id) ?? null })),
      total: totals?.total ?? 0,
    };
  },
};
