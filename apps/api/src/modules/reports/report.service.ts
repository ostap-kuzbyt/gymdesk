import { and, asc, between, desc, eq, gte, inArray, isNull, lte, max, sql } from "drizzle-orm";
import type { AttendanceReport, LoadReport, LoadRow, RevenueReport } from "@gymdesk/shared";
import type { Clock } from "../../platform/clock.js";
import type { Db } from "../../platform/db/client.js";
import {
  checkIns,
  coaches,
  members,
  reservations,
  studios,
  subscriptions,
  workouts,
} from "../../platform/db/schema.js";

interface DateRange {
  from: string;
  to: string;
}

function minutesBetween(startTime: string, endTime: string): number {
  const toMinutes = (time: string) => {
    const [hours = 0, minutes = 0] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };
  return toMinutes(endTime) - toMinutes(startTime);
}

function periodsBetween(range: DateRange, granularity: "month" | "year"): string[] {
  const periods: string[] = [];
  let year = Number(range.from.slice(0, 4));
  let month = Number(range.from.slice(5, 7));
  const lastYear = Number(range.to.slice(0, 4));
  const lastMonth = Number(range.to.slice(5, 7));

  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    if (granularity === "year") {
      periods.push(String(year));
      year += 1;
    } else {
      periods.push(`${year}-${String(month).padStart(2, "0")}`);
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  }
  return periods;
}

export class ReportService {
  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
  ) {}

  async attendance(
    range: DateRange,
    page: { limit: number; offset: number },
  ): Promise<AttendanceReport> {
    const visits = sql<number>`count(${checkIns.id}) filter (where ${checkIns.visitDate} between ${range.from} and ${range.to})::int`;

    const rows = await this.db
      .select({
        memberId: members.id,
        fullName: members.fullName,
        email: members.email,
        visits,
        lastVisitOn: max(checkIns.visitDate),
      })
      .from(members)
      .leftJoin(checkIns, eq(checkIns.memberId, members.id))
      .groupBy(members.id)
      .orderBy(desc(visits), asc(members.fullName), asc(members.id))
      .limit(page.limit)
      .offset(page.offset);

    const [totals] = await this.db.select({ total: sql<number>`count(*)::int` }).from(members);

    const today = this.clock.today();
    const current =
      rows.length === 0
        ? []
        : await this.db
            .select({ memberId: subscriptions.memberId, endsOn: subscriptions.endsOn })
            .from(subscriptions)
            .where(
              and(
                inArray(
                  subscriptions.memberId,
                  rows.map((row) => row.memberId),
                ),
                isNull(subscriptions.cancelledOn),
                lte(subscriptions.startsOn, today),
                gte(subscriptions.endsOn, today),
              ),
            );
    const activeUntil = new Map(current.map((row) => [row.memberId, row.endsOn]));

    return {
      ...range,
      items: rows.map((row) => ({
        ...row,
        lastVisitOn: row.lastVisitOn ?? null,
        activeUntil: activeUntil.get(row.memberId) ?? null,
      })),
      total: totals?.total ?? 0,
    };
  }

  async revenue(range: DateRange, granularity: "month" | "year"): Promise<RevenueReport> {
    const period =
      granularity === "year"
        ? sql<string>`to_char(${subscriptions.startsOn}, 'YYYY')`
        : sql<string>`to_char(${subscriptions.startsOn}, 'YYYY-MM')`;

    const rows = await this.db
      .select({
        period,
        revenueCents: sql<number>`coalesce(sum(${subscriptions.priceCents}), 0)::bigint`.mapWith(
          Number,
        ),
        subscriptions: sql<number>`count(*)::int`,
      })
      .from(subscriptions)
      .where(
        and(
          isNull(subscriptions.cancelledOn),
          between(subscriptions.startsOn, range.from, range.to),
        ),
      )
      .groupBy(period)
      .orderBy(asc(period));

    const byPeriod = new Map(rows.map((row) => [row.period, row]));
    const filled = periodsBetween(range, granularity).map(
      (key) => byPeriod.get(key) ?? { period: key, revenueCents: 0, subscriptions: 0 },
    );

    return {
      granularity,
      rows: filled,
      totalCents: filled.reduce((sum, row) => sum + row.revenueCents, 0),
      totalSubscriptions: filled.reduce((sum, row) => sum + row.subscriptions, 0),
    };
  }

  async load(range: DateRange): Promise<LoadReport> {
    const reserved = sql<number>`count(${reservations.id})::int`;

    const rows = await this.db
      .select({
        workoutId: workouts.id,
        date: workouts.workoutDate,
        startTime: workouts.startTime,
        endTime: workouts.endTime,
        capacity: workouts.capacity,
        coachId: coaches.id,
        coachName: coaches.fullName,
        studioId: studios.id,
        studioName: studios.name,
        reserved,
      })
      .from(workouts)
      .innerJoin(coaches, eq(coaches.id, workouts.coachId))
      .innerJoin(studios, eq(studios.id, workouts.studioId))
      .leftJoin(
        reservations,
        and(eq(reservations.workoutId, workouts.id), isNull(reservations.cancelledAt)),
      )
      .where(
        and(between(workouts.workoutDate, range.from, range.to), eq(workouts.cancelled, false)),
      )
      .groupBy(workouts.id, coaches.id, studios.id)
      .orderBy(asc(workouts.workoutDate), asc(workouts.startTime));

    const aggregate = (key: "coach" | "studio"): LoadRow[] => {
      const buckets = new Map<string, LoadRow>();
      for (const row of rows) {
        const id = key === "coach" ? row.coachId : row.studioId;
        const name = key === "coach" ? row.coachName : row.studioName;
        const bucketKey = `${row.date}|${id}`;
        const bucket = buckets.get(bucketKey) ?? {
          date: row.date,
          id,
          name,
          workouts: 0,
          minutes: 0,
          reserved: 0,
          capacity: 0,
        };
        bucket.workouts += 1;
        bucket.minutes += minutesBetween(row.startTime, row.endTime);
        bucket.reserved += row.reserved;
        bucket.capacity += row.capacity;
        buckets.set(bucketKey, bucket);
      }
      return [...buckets.values()].sort(
        (a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name),
      );
    };

    return { ...range, coaches: aggregate("coach"), studios: aggregate("studio") };
  }
}
