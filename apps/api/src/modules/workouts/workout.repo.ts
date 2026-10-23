import { and, asc, between, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { reservations, workouts } from "../../platform/db/schema.js";
import type { Executor } from "../../platform/db/tx.js";
import { ConflictError } from "../../platform/errors.js";
import { Workout } from "./workout.js";
import type { Reservation, WorkoutKind } from "./workout.js";

type WorkoutRow = typeof workouts.$inferSelect;
type ReservationRow = typeof reservations.$inferSelect;

export interface WorkoutListRow {
  id: string;
  title: string;
  kind: WorkoutKind;
  studioId: string;
  coachId: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  reserved: number;
  cancelled: boolean;
}

export interface WorkoutFilter {
  from: string;
  to: string;
  studioId?: string | undefined;
  coachId?: string | undefined;
  includeCancelled: boolean;
}

export interface Slot {
  studioId: string;
  coachId: string;
  date: string;
  startTime: string;
  endTime: string;
}

const hhmm = (value: string) => value.slice(0, 5);

function toReservation(row: ReservationRow): Reservation {
  return {
    id: row.id,
    memberId: row.memberId,
    reservedAt: row.reservedAt.toISOString(),
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
  };
}

function toKind(value: string): WorkoutKind {
  return value === "individual" ? "individual" : "group";
}

function toListRow(row: WorkoutRow, reserved: number): WorkoutListRow {
  return {
    id: row.id,
    title: row.title,
    kind: toKind(row.kind),
    studioId: row.studioId,
    coachId: row.coachId,
    date: row.workoutDate,
    startTime: hhmm(row.startTime),
    endTime: hhmm(row.endTime),
    capacity: row.capacity,
    reserved,
    cancelled: row.cancelled,
  };
}

async function upsertReservations(db: Executor, workoutId: string, items: Reservation[]) {
  if (items.length === 0) return;
  await db
    .insert(reservations)
    .values(
      items.map((item) => ({
        id: item.id,
        workoutId,
        memberId: item.memberId,
        reservedAt: new Date(item.reservedAt),
        cancelledAt: item.cancelledAt ? new Date(item.cancelledAt) : null,
      })),
    )
    .onConflictDoUpdate({
      target: reservations.id,
      set: { cancelledAt: sql`excluded.cancelled_at` },
    });
}

export const workoutRepo = {
  async findById(db: Executor, id: string): Promise<Workout | undefined> {
    const [row] = await db.select().from(workouts).where(eq(workouts.id, id));
    if (!row) return undefined;

    const owned = await db
      .select()
      .from(reservations)
      .where(eq(reservations.workoutId, id))
      .orderBy(asc(reservations.reservedAt), asc(reservations.id));

    const listRow = toListRow(row, 0);
    return Workout.restore({
      id: row.id,
      title: row.title,
      kind: listRow.kind,
      studioId: row.studioId,
      coachId: row.coachId,
      date: row.workoutDate,
      startTime: listRow.startTime,
      endTime: listRow.endTime,
      capacity: row.capacity,
      cancelled: row.cancelled,
      version: row.version,
      reservations: owned.map(toReservation),
    });
  },

  async insert(db: Executor, workout: Workout): Promise<void> {
    const { reservations: items, date, ...rest } = workout.toSnapshot();
    await db.insert(workouts).values({ ...rest, workoutDate: date });
    await upsertReservations(db, rest.id, items);
  },

  async save(db: Executor, workout: Workout): Promise<void> {
    const { id, version, cancelled, reservations: items } = workout.toSnapshot();
    const updated = await db
      .update(workouts)
      .set({ cancelled, version: version + 1 })
      .where(and(eq(workouts.id, id), eq(workouts.version, version)))
      .returning({ id: workouts.id });

    if (updated.length === 0) {
      throw new ConflictError("The workout was changed by someone else, reload and try again");
    }
    await upsertReservations(db, id, items);
  },

  async list(db: Executor, filter: WorkoutFilter): Promise<WorkoutListRow[]> {
    const rows = await db
      .select()
      .from(workouts)
      .where(
        and(
          between(workouts.workoutDate, filter.from, filter.to),
          filter.studioId ? eq(workouts.studioId, filter.studioId) : undefined,
          filter.coachId ? eq(workouts.coachId, filter.coachId) : undefined,
          filter.includeCancelled ? undefined : eq(workouts.cancelled, false),
        ),
      )
      .orderBy(asc(workouts.workoutDate), asc(workouts.startTime), asc(workouts.id));
    if (rows.length === 0) return [];

    const counts = await db
      .select({ workoutId: reservations.workoutId, reserved: sql<number>`count(*)::int` })
      .from(reservations)
      .where(
        and(
          inArray(
            reservations.workoutId,
            rows.map((row) => row.id),
          ),
          isNull(reservations.cancelledAt),
        ),
      )
      .groupBy(reservations.workoutId);
    const reserved = new Map(counts.map((row) => [row.workoutId, row.reserved]));

    return rows.map((row) => toListRow(row, reserved.get(row.id) ?? 0));
  },

  async findClash(db: Executor, slot: Slot): Promise<"studio" | "coach" | undefined> {
    const rows = await db
      .select({ studioId: workouts.studioId, coachId: workouts.coachId })
      .from(workouts)
      .where(
        and(
          eq(workouts.workoutDate, slot.date),
          eq(workouts.cancelled, false),
          sql`${workouts.startTime} < ${slot.endTime}::time`,
          sql`${workouts.endTime} > ${slot.startTime}::time`,
          or(eq(workouts.studioId, slot.studioId), eq(workouts.coachId, slot.coachId)),
        ),
      );

    if (rows.some((row) => row.studioId === slot.studioId)) return "studio";
    if (rows.some((row) => row.coachId === slot.coachId)) return "coach";
    return undefined;
  },
};
