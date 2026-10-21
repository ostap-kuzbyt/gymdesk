import { and, asc, eq } from "drizzle-orm";
import { studios } from "../../platform/db/schema.js";
import type { Executor } from "../../platform/db/tx.js";
import { ConflictError } from "../../platform/errors.js";
import { Studio } from "./studio.js";

type StudioRow = typeof studios.$inferSelect;

function toEntity(row: StudioRow): Studio {
  return Studio.restore({
    id: row.id,
    name: row.name,
    capacity: row.capacity,
    archived: row.archived,
    version: row.version,
  });
}

export const studioRepo = {
  async findById(db: Executor, id: string): Promise<Studio | undefined> {
    const [row] = await db.select().from(studios).where(eq(studios.id, id));
    return row && toEntity(row);
  },

  async list(db: Executor, options: { includeArchived: boolean }): Promise<Studio[]> {
    const rows = await db
      .select()
      .from(studios)
      .where(options.includeArchived ? undefined : eq(studios.archived, false))
      .orderBy(asc(studios.name));
    return rows.map(toEntity);
  },

  async insert(db: Executor, studio: Studio): Promise<void> {
    await db.insert(studios).values(studio.toSnapshot());
  },

  async save(db: Executor, studio: Studio): Promise<void> {
    const { id, version, ...columns } = studio.toSnapshot();
    const updated = await db
      .update(studios)
      .set({ ...columns, version: version + 1 })
      .where(and(eq(studios.id, id), eq(studios.version, version)))
      .returning({ id: studios.id });

    if (updated.length === 0) {
      throw new ConflictError("The studio was changed by someone else, reload and try again");
    }
  },
};
