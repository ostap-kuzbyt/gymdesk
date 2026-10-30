import { and, asc, eq } from "drizzle-orm";
import { coaches } from "../../platform/db/schema.js";
import type { Executor } from "../../platform/db/tx.js";
import { ConflictError } from "../../platform/errors.js";
import { Coach } from "./coach.js";

type CoachRow = typeof coaches.$inferSelect;

function toEntity(row: CoachRow): Coach {
  return Coach.restore({
    id: row.id,
    fullName: row.fullName,
    specialization: row.specialization,
    weeklyHours: row.weeklyHours,
    authSubject: row.authSubject,
    archived: row.archived,
    version: row.version,
  });
}

export const coachRepo = {
  async findById(db: Executor, id: string): Promise<Coach | undefined> {
    const [row] = await db.select().from(coaches).where(eq(coaches.id, id));
    return row && toEntity(row);
  },

  async findByAuthSubject(db: Executor, subject: string): Promise<Coach | undefined> {
    const [row] = await db.select().from(coaches).where(eq(coaches.authSubject, subject));
    return row && toEntity(row);
  },

  async list(db: Executor, options: { includeArchived: boolean }): Promise<Coach[]> {
    const rows = await db
      .select()
      .from(coaches)
      .where(options.includeArchived ? undefined : eq(coaches.archived, false))
      .orderBy(asc(coaches.fullName), asc(coaches.id));
    return rows.map(toEntity);
  },

  async insert(db: Executor, coach: Coach): Promise<void> {
    await db.insert(coaches).values(coach.toSnapshot());
  },

  async save(db: Executor, coach: Coach): Promise<void> {
    const { id, version, ...columns } = coach.toSnapshot();
    const updated = await db
      .update(coaches)
      .set({ ...columns, version: version + 1 })
      .where(and(eq(coaches.id, id), eq(coaches.version, version)))
      .returning({ id: coaches.id });

    if (updated.length === 0) {
      throw new ConflictError("The coach was changed by someone else, reload and try again");
    }
  },
};
